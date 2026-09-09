import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

// 4.6 聊天消息模糊搜索：匹配 content.text 与 content.choices 里的文案。
const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-search-'))
process.env.ACW_DATA_ROOT = dataRoot

const { initDb, getDb } = await import('../src/db.js')
initDb()
const { createMember, createGroup, createSessionFromGroup, searchMessages } =
  await import('../src/services.js')
const { MEMBER_KIND } = await import('@acw/shared')

function seedSession(title) {
  const member = createMember({
    name: `echo-${Date.now()}-${Math.random()}`,
    displayName: '回声成员',
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

function insertMessage(sessionId, { role, type = 'text', content }) {
  getDb()
    .prepare(
      `INSERT INTO messages (id, session_id, role, type, content_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      `m-${Date.now()}-${Math.random()}`,
      sessionId,
      role,
      type,
      JSON.stringify(content),
      new Date().toISOString(),
    )
}

test('searchMessages: content.text（用户消息）命中', () => {
  const session = seedSession('搜索甲')
  insertMessage(session.id, { role: 'user', content: { text: '成员管理模块的测试tokenABC' } })
  const r = searchMessages('tokenabc') // 大小写不敏感子串
  assert.ok(r.hits.some((h) => h.sessionId === session.id && h.snippet.includes('tokenABC')))
})

test('searchMessages: content.choices（AI 消息）命中', () => {
  const session = seedSession('搜索乙')
  insertMessage(session.id, {
    role: 'assistant',
    content: { choices: [{ text: '这是一条AI产出中文内容' }, { text: '目标tokenxyz' }] },
  })
  const r = searchMessages('tokenxyz')
  assert.ok(r.hits.some((h) => h.sessionId === session.id && h.snippet.includes('tokenxyz')))
})

test('searchMessages: 中文拼音命中 choices 文案', () => {
  const session = seedSession('搜索丙')
  insertMessage(session.id, {
    role: 'assistant',
    content: { choices: [{ text: '完成成员管理模块改造' }] },
  })
  const r = searchMessages('chengyuan') // 全拼命中「成员」
  assert.ok(r.hits.some((h) => h.sessionId === session.id && h.snippet.includes('成员')))
})

test('searchMessages: sessionId 限定 + 未命中为空', () => {
  const a = seedSession('限A')
  const b = seedSession('限B')
  insertMessage(a.id, { role: 'user', content: { text: '只在A里的目标词' } })
  insertMessage(b.id, { role: 'user', content: { text: '另一段无关文本' } })
  const ra = searchMessages('目标词', { sessionId: a.id })
  assert.ok(ra.hits.every((h) => h.sessionId === a.id) && ra.hits.length >= 1)
  const rb = searchMessages('目标词', { sessionId: b.id })
  assert.equal(rb.hits.length, 0)
})

test('searchMessages: 空查询返回空', () => {
  const session = seedSession('空查')
  insertMessage(session.id, { role: 'user', content: { text: '任意内容' } })
  const r = searchMessages('')
  assert.equal(r.hits.length, 0)
})

test('searchMessages: 单字母 ASCII 不搜；命中按分数排序', () => {
  const session = seedSession('短查')
  insertMessage(session.id, { role: 'user', content: { text: 'alpha 噪声行' } })
  insertMessage(session.id, { role: 'user', content: { text: '精确 tokenXYZ 目标' } })
  assert.equal(searchMessages('a', { sessionId: session.id }).hits.length, 0)
  const r = searchMessages('tokenXYZ', { sessionId: session.id })
  assert.ok(r.hits[0].snippet.includes('tokenXYZ'))
  assert.ok(r.hits[0].score >= 70)
})
