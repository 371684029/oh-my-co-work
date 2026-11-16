import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-term-rehyd-'))
process.env.ACW_DATA_ROOT = dataRoot
fs.mkdirSync(path.join(dataRoot, 'logs'), { recursive: true })

const { initDb, getDb } = await import('../src/db.js')
initDb()
const terminalService = await import('../src/terminal/terminalService.js')
const { listPersistedTerminalsForSession } = await import('../src/terminal/terminalRehydrate.js')

test('listSessionTerminals rehydrates from DB+log after memory map is empty', () => {
  const termId = 'term_rehyd_test_1'
  const sessionId = 'ses_rehyd_1'
  const logName = `terminal_${termId}.log`
  const logPath = path.join(dataRoot, 'logs', logName)
  fs.writeFileSync(logPath, 'line one\n操作成功！\nwll/1113/instore\n')

  getDb()
    .prepare(
      `INSERT INTO terminal_sessions
        (id, session_id, status, cwd, command_label, log_path, exit_code, started_at, finished_at)
       VALUES (?, ?, 'exited', '/tmp', 'newBranch', ?, 0, '2026-01-01T00:00:00Z', '2026-01-01T00:01:00Z')`,
    )
    .run(termId, sessionId, logName)

  const persisted = listPersistedTerminalsForSession(sessionId, new Set(), { includeReplay: true })
  assert.equal(persisted.length, 1)
  assert.equal(persisted[0].id, termId)
  assert.match(persisted[0].replay, /操作成功/)
  assert.equal(persisted[0].rehydrated, true)

  const listed = terminalService.listSessionTerminals(sessionId, { includeReplay: true })
  assert.equal(listed.length, 1)
  assert.match(listed[0].replay, /操作成功/)
})