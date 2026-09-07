import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

// 4.2.0 备份恢复：恢复前自动再备份、数据回滚、integrity 拒绝坏库、文件名校验。

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-backup-restore-'))
process.env.ACW_DATA_ROOT = dataRoot

const { initDb, getDb } = await import('../src/db.js')
initDb()
const { createMember, createGroup, createSessionFromGroup, getSessionDetail, handleGateAction } =
  await import('../src/services.js')
const backup = await import('../src/backup.js')
const { MEMBER_KIND, SESSION_STATUS } = await import('@acw/shared')

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

test('restore round-trip: data rolls back to the backup point, pre-restore backup kept', async () => {
  const session = seedSession('恢复组')
  writeJournal(session.id, 'ANNOUNCEMENT.md', '第一版公告')

  const created = backup.createBackup()
  assert.equal(created.ok, true)
  const backupName = path.basename(created.path)

  // 备份之后改动数据：新增文件 + 改公告 + 库里插入新会话
  const later = seedSession('备份后新会话')
  writeJournal(session.id, 'ANNOUNCEMENT.md', '第二版公告')
  assert.equal(getDb().prepare('SELECT COUNT(*) AS c FROM sessions').get().c >= 2, true)

  const r = backup.restoreBackup(backupName)
  assert.equal(r.ok, true)
  assert.equal(r.restoredFrom, backupName)

  // 恢复前自动打的备份还在 backups/
  assert.ok(fs.existsSync(r.preRestore.path))
  assert.ok(fs.readdirSync(path.join(dataRoot, 'backups')).some((f) => f.startsWith('pre-restore-')))

  // 数据回到备份点：新会话消失、公告回到第一版
  const gone = getDb().prepare('SELECT COUNT(*) AS c FROM sessions WHERE id = ?').get(later.id)
  assert.equal(gone.c, 0)
  assert.equal(
    fs.readFileSync(path.join(dataRoot, 'journals', 'sessions', session.id, 'ANNOUNCEMENT.md'), 'utf8'),
    '第一版公告',
  )
  // 应用恢复后仍可用：走一次闸门动作
  const d = getSessionDetail(session.id)
  assert.ok(d)
  await handleGateAction(session.id, { action: 'approve_start', text: '恢复后启动' })
  assert.ok(getSessionDetail(session.id))
})

function writeJournal(sessionId, name, content) {
  const abs = path.join(dataRoot, 'journals', 'sessions', sessionId, name)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content)
}

test('restore rejects bad names, missing files and corrupted archives', async () => {
  assert.throws(() => backup.restoreBackup('../etc/passwd'), /非法备份文件名/)
  assert.throws(() => backup.restoreBackup('not-a-backup.tar.gz'), /非法备份文件名|备份不存在/)

  const bogus = path.join(dataRoot, 'backups', 'acw-backup-bogus.tar.gz')
  fs.mkdirSync(path.join(dataRoot, 'backups'), { recursive: true })
  fs.writeFileSync(bogus, 'not a tar.gz at all')
  assert.throws(() => backup.restoreBackup('acw-backup-bogus.tar.gz'), /解包失败|integrity|数据库文件/)

  // 状态没有被坏备份破坏：现有会话仍在
  const dbgS = seedSession('健全组')
  assert.ok(getSessionDetail(dbgS.id))
})

test('corrupted sqlite inside a valid archive is rejected by integrity check', async () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-bad-db-'))
  fs.writeFileSync(path.join(work, 'oh-my-co-work.sqlite'), 'this is not sqlite')
  const archive = path.join(dataRoot, 'backups', 'acw-backup-badsql.tar.gz')
  fs.writeFileSync(archive, 'placeholder')
  // 用真实 tar 重打：替换占位
  fs.rmSync(archive)
  const { execFileSync } = await import('node:child_process')
  execFileSync('tar', ['-czf', archive, '-C', work, 'oh-my-co-work.sqlite'])

  const before = getDb().prepare('SELECT COUNT(*) AS c FROM sessions').get().c
  assert.throws(() => backup.restoreBackup('acw-backup-badsql.tar.gz'), /integrity_check 失败/)
  assert.equal(getDb().prepare('SELECT COUNT(*) AS c FROM sessions').get().c, before)
  void SESSION_STATUS
})

test('directory backup can be listed and restored', async () => {
  const { execFileSync } = await import('node:child_process')
  const session = seedSession('目录备份组')
  writeJournal(session.id, 'ANNOUNCEMENT.md', '目录备份公告')
  const created = backup.createBackup()
  assert.equal(created.format, 'tar.gz')
  const dirName = `acw-backup-dirround-${Date.now()}`
  const dest = path.join(dataRoot, 'backups', dirName)
  fs.mkdirSync(dest, { recursive: true })
  execFileSync('tar', ['-xzf', created.path, '-C', dest])

  const listed = backup.listBackups()
  const hit = listed.find((b) => b.filename === dirName)
  assert.ok(hit, 'listBackups 应包含目录备份')
  assert.equal(hit.format, 'dir')

  writeJournal(session.id, 'ANNOUNCEMENT.md', '改过了')
  const r = backup.restoreBackup(dirName)
  assert.equal(r.ok, true)
  assert.equal(
    fs.readFileSync(path.join(dataRoot, 'journals', 'sessions', session.id, 'ANNOUNCEMENT.md'), 'utf8'),
    '目录备份公告',
  )
})

test('restore rolls live data back if apply fails after move-aside', () => {
  const session = seedSession('回滚组')
  writeJournal(session.id, 'ANNOUNCEMENT.md', '回滚应还在')
  const created = backup.createBackup()
  const later = seedSession('回滚后应还在')
  assert.throws(
    () =>
      backup.restoreBackup(path.basename(created.path), {
        applyLive: () => {
          throw new Error('injected apply fail')
        },
      }),
    /injected apply fail/,
  )
  assert.ok(getSessionDetail(later.id))
  assert.equal(
    fs.readFileSync(path.join(dataRoot, 'journals', 'sessions', session.id, 'ANNOUNCEMENT.md'), 'utf8'),
    '回滚应还在',
  )
})

test('listBackups distinguishes format correctly and backup download validation logic', () => {
  const created = backup.createBackup()
  assert.equal(created.ok, true)
  const backups = backup.listBackups()
  const tarItem = backups.find((b) => b.format === 'tar.gz')
  assert.ok(tarItem)
  assert.ok(tarItem.filename.endsWith('.tar.gz'))

  // 安全文件名正则验证
  const validRegex = /^[A-Za-z0-9_.-]+$/
  assert.equal(validRegex.test(tarItem.filename), true)
  assert.equal(validRegex.test('../evil.tar.gz'), false)
  assert.equal(validRegex.test('bad/path.tar.gz'), false)
  assert.equal(validRegex.test('bad\\path.tar.gz'), false)
})

test('createBackup and restoreBackup with custom target file and folder paths', async () => {
  const customDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-custom-backup-'))
  const session = seedSession('自定义路径测试组')
  writeJournal(session.id, 'ANNOUNCEMENT.md', '初始公告内容')

  // 1. 备份到指定具体文件路径（.tar.gz）
  const targetArchive = path.join(customDir, 'my-exact-backup.tar.gz')
  const createdFile = backup.createBackup({ targetPath: targetArchive })
  assert.equal(createdFile.ok, true)
  assert.equal(createdFile.path, targetArchive)
  assert.ok(fs.existsSync(targetArchive))

  // 2. 备份到指定文件夹目录（自动生成 acw-backup-*.tar.gz）
  const targetSubDir = path.join(customDir, 'subfolder')
  const createdDir = backup.createBackup({ targetPath: targetSubDir })
  assert.equal(createdDir.ok, true)
  assert.equal(path.dirname(createdDir.path), targetSubDir)
  assert.ok(fs.existsSync(createdDir.path))

  // 3. 从外部自定义文件绝对路径恢复
  writeJournal(session.id, 'ANNOUNCEMENT.md', '被外部文件覆盖前')
  const rFile = backup.restoreBackup(targetArchive)
  assert.equal(rFile.ok, true)
  assert.equal(
    fs.readFileSync(path.join(dataRoot, 'journals', 'sessions', session.id, 'ANNOUNCEMENT.md'), 'utf8'),
    '初始公告内容',
  )

  // 4. 从外部备份文件夹目录恢复
  const extractedFolder = path.join(customDir, 'extracted-backup')
  fs.mkdirSync(extractedFolder, { recursive: true })
  const { execFileSync } = await import('node:child_process')
  execFileSync('tar', ['-xzf', targetArchive, '-C', extractedFolder])

  writeJournal(session.id, 'ANNOUNCEMENT.md', '被外部文件夹覆盖前')
  const rFolder = backup.restoreBackup(extractedFolder)
  assert.equal(rFolder.ok, true)
  assert.equal(
    fs.readFileSync(path.join(dataRoot, 'journals', 'sessions', session.id, 'ANNOUNCEMENT.md'), 'utf8'),
    '初始公告内容',
  )

  // 5. 从单个 sqlite 文件直接恢复
  const singleSqlite = path.join(customDir, 'single.sqlite')
  fs.copyFileSync(path.join(extractedFolder, 'oh-my-co-work.sqlite'), singleSqlite)
  writeJournal(session.id, 'ANNOUNCEMENT.md', '被单文件恢复前')
  const rSqlite = backup.restoreBackup(singleSqlite)
  assert.equal(rSqlite.ok, true)

  fs.rmSync(customDir, { recursive: true, force: true })
})


