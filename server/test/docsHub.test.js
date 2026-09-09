import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

// 4.0.0 文档中心服务端测试：扫描结构、双排序、白名单与穿越拦截、
// 1MB 截断、公告保存 manual 语义、open-path 防误执行。

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-docs-hub-'))
process.env.ACW_DATA_ROOT = dataRoot

const { initDb, getDb } = await import('../src/db.js')
initDb()
const { createMember, createGroup, createSessionFromGroup } = await import('../src/services.js')
const docsHub = await import('../src/docsHub.js')
const { MEMBER_KIND } = await import('@acw/shared')

function seedSession(title) {
  const member = createMember({
    name: `echo-${Date.now()}-${Math.random()}`,
    displayName: '回声',
    kind: MEMBER_KIND.ECHO,
    workFolder: process.cwd(),
    config: { defaultText: 'ok' },
  })
  const group = createGroup({
    title,
    workFolder: process.cwd(),
    steps: [{ title: '回声', type: 'member', memberId: member.id, gate: false }],
  })
  return createSessionFromGroup(group.id)
}

function writeDoc(sessionId, rel, content) {
  const abs = path.join(dataRoot, 'journals', 'sessions', sessionId, ...rel.split('/'))
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content)
}

test('listDocs groups by group template with whitelisted files only', () => {
  const session = seedSession('文档组甲')
  writeDoc(session.id, 'ANNOUNCEMENT.md', '# 报告\n内容一')
  writeDoc(session.id, 'README.md', '# 索引')
  writeDoc(session.id, 'nodes/step-00-abc.md', '台账一')
  writeDoc(session.id, 'secret.md', '不该出现') // 白名单外
  writeDoc(session.id, 'nodes/notes.txt', '不该出现') // 白名单外
  docsHub.invalidateDocsCache()

  const out = docsHub.listDocs({ sort: 'group' })
  const group = out.groups.find((g) => g.groupTitle === '文档组甲')
  assert.ok(group, '分组应包含文档组甲')
  const item = group.sessions.find((s) => s.sessionId === session.id)
  assert.ok(item)
  const names = item.files.map((f) => f.name)
  assert.deepEqual(names, ['ANNOUNCEMENT.md', 'README.md', 'nodes/step-00-abc.md'])
  assert.equal(item.files[0].kind, 'announce')
  assert.equal(item.files[2].kind, 'step')
  // 越权文件不在列表里
  assert.equal(names.includes('secret.md'), false)
})

test('listDocs time sort returns flat items newest first', async () => {
  const a = seedSession('时间组')
  writeDoc(a.id, 'ANNOUNCEMENT.md', '旧文件')
  await new Promise((r) => setTimeout(r, 30))
  const b = seedSession('时间组')
  writeDoc(b.id, 'ANNOUNCEMENT.md', '新文件')
  docsHub.invalidateDocsCache()

  const out = docsHub.listDocs({ sort: 'time' })
  const mine = out.items.filter((i) => i.sessionId === a.id || i.sessionId === b.id)
  assert.equal(mine[0].sessionId, b.id)
  assert.equal(mine[0].groupTitle, '时间组')
  assert.ok(mine[0].mtimeMs >= mine[mine.length - 1].mtimeMs)
})

test('readDoc enforces whitelist and blocks traversal', () => {
  const session = seedSession('穿越组')
  writeDoc(session.id, 'ANNOUNCEMENT.md', '正文')
  writeDoc(session.id, 'nodes/step-00-abc.md', '台账')
  assert.equal(docsHub.readDoc(session.id, 'ANNOUNCEMENT.md').content, '正文')
  assert.equal(docsHub.readDoc(session.id, 'nodes/step-00-abc.md').kind, 'step')

  assert.throws(() => docsHub.readDoc(session.id, '../config.json'), /白名单/)
  assert.throws(() => docsHub.readDoc(session.id, '..\\..\\db.sqlite'), /白名单/)
  assert.throws(() => docsHub.readDoc(session.id, 'nodes/../../secret.md'), /白名单/)
  assert.throws(() => docsHub.readDoc('ses_not_exists', 'ANNOUNCEMENT.md'), /会话不存在/)
})

test('readDoc truncates files larger than 1MB', () => {
  const session = seedSession('截断组')
  const big = 'x'.repeat(1024 * 1024 + 2048)
  writeDoc(session.id, 'nodes/step-01-big.md', big)
  const out = docsHub.readDoc(session.id, 'nodes/step-01-big.md')
  assert.equal(out.truncated, true)
  assert.equal(out.content.length, 1024 * 1024)
  assert.equal(out.size, big.length)
})

test('saveAnnouncement writes file and marks announcementManual', () => {
  const session = seedSession('编辑组')
  writeDoc(session.id, 'ANNOUNCEMENT.md', '自动版')
  const before = docsHub.readDoc(session.id, 'ANNOUNCEMENT.md').mtimeMs

  docsHub.saveAnnouncement(session.id, '人工编辑版')
  const after = docsHub.readDoc(session.id, 'ANNOUNCEMENT.md')
  assert.equal(after.content, '人工编辑版')
  assert.ok(after.mtimeMs >= before)

  const row = getDb().prepare('SELECT context_json FROM sessions WHERE id = ?').get(session.id)
  const ctx = JSON.parse(row.context_json)
  assert.equal(ctx.announcementManual, true)
  // 缓存已失效：列表立刻反映新 mtime
  const out = docsHub.listDocs({ sort: 'group' })
  const item = out.groups.flatMap((g) => g.sessions).find((s) => s.sessionId === session.id)
  assert.equal(item.files[0].mtimeMs, after.mtimeMs)
})

test('openDocsPath opens directories but only the containing dir for files', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-open-path-'))
  const file = path.join(dir, 'evil.exe')
  fs.writeFileSync(file, 'MZ')

  const opened = []
  const deps = { openTarget: async (p) => opened.push(p) }

  await docsHub.openDocsPath(dir, deps)
  assert.deepEqual(opened, [dir])

  await docsHub.openDocsPath(file, deps)
  assert.equal(opened[1], dir) // 文件 → 打开所在目录，绝不是文件本身
  assert.notEqual(opened[1], file)

  await assert.rejects(() => docsHub.openDocsPath(path.join(dir, 'no-such-dir'), deps), /不存在/)
  await assert.rejects(() => docsHub.openDocsPath('', deps), /路径为空/)
})

test('readDoc maps step-*.md alias into nodes/', () => {
  const session = seedSession('别名组')
  writeDoc(session.id, 'nodes/step-02-xyz.md', '台账正文')
  const out = docsHub.readDoc(session.id, 'step-02-xyz.md')
  assert.equal(out.name, 'nodes/step-02-xyz.md')
  assert.equal(out.kind, 'step')
  assert.equal(out.content, '台账正文')
})

test('searchDocs finds unique needle in announcement', () => {
  const session = seedSession('检索组')
  const token = `ZXQSEARCHTOKEN${Date.now()}`
  writeDoc(session.id, 'ANNOUNCEMENT.md', `前缀 ${token} 后缀`)
  docsHub.invalidateDocsCache()
  const r = docsHub.searchDocs(token)
  assert.ok(r.hits.some((h) => h.sessionId === session.id && h.snippet.includes(token)))
})

test('searchDocs fuzzy: 拼音命中中文行 + 会话标题命中', () => {
  const session = seedSession('模糊检索组')
  writeDoc(session.id, 'nodes/step-01-a.md', '今天完成成员管理模块')
  docsHub.invalidateDocsCache()
  // 全拼 chengyuan 命中「成员」
  const r1 = docsHub.searchDocs('chengyuan')
  assert.ok(r1.hits.some((h) => h.sessionId === session.id && h.snippet.includes('成员')))
  // 会话标题命中「模糊检索组」的首字母
  const r2 = docsHub.searchDocs('mhjs')
  assert.ok(r2.hits.some((h) => h.sessionId === session.id && h.kind === 'index'))
})

test('exportGroupZip returns slug and a zip file', () => {
  const session = seedSession('导出组甲')
  writeDoc(session.id, 'ANNOUNCEMENT.md', '导出内容')
  const groupId = getDb().prepare('SELECT group_id FROM sessions WHERE id = ?').get(session.id).group_id
  const out = docsHub.exportGroupZip(groupId)
  assert.ok(out.slug)
  assert.equal(out.filename, `${out.slug}.zip`)
  assert.ok(out.files >= 1)
  assert.ok(fs.existsSync(out.path))
  assert.ok(fs.statSync(out.path).size > 0)
  fs.rmSync(out.path, { force: true })
})

test('exportAllDocsZip packages all documents across sessions', () => {
  const s1 = seedSession('全量导出组1')
  writeDoc(s1.id, 'ANNOUNCEMENT.md', '全量内容1')
  const s2 = seedSession('全量导出组2')
  writeDoc(s2.id, 'nodes/step-00-init.md', '台账内容2')

  const out = docsHub.exportAllDocsZip()
  assert.ok(out.filename.startsWith('oh-my-co-work-all-docs-'))
  assert.equal(out.filename.endsWith('.zip'), true)
  assert.ok(out.files >= 2)
  assert.ok(fs.existsSync(out.path))
  assert.ok(fs.statSync(out.path).size > 0)
  fs.rmSync(out.path, { force: true })
})

test('exportAllDocsZip with empty sessions provides placeholder README.md', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-docs-empty-'))
  const origDataRoot = process.env.ACW_DATA_ROOT
  process.env.ACW_DATA_ROOT = tempDir
  try {
    const out = docsHub.exportAllDocsZip()
    assert.ok(out.filename.startsWith('oh-my-co-work-all-docs-'))
    assert.equal(out.filename.endsWith('.zip'), true)
    assert.ok(fs.existsSync(out.path))
    assert.ok(fs.statSync(out.path).size > 0)
    fs.rmSync(out.path, { force: true })
  } finally {
    process.env.ACW_DATA_ROOT = origDataRoot
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})


