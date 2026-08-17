import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-terminal-test-'))
process.env.ACW_DATA_ROOT = dataRoot

const terminalService = await import('../src/terminal/terminalService.js')
const bus = await import('../src/bus.js')

function terminalOptions(sessionId, script) {
  return {
    launch: { cmd: 'bash', args: ['-lc', script], label: 'bash' },
    cwd: process.cwd(),
    env: { ...process.env, npm_config_prefix: '' },
    sessionId,
    memberId: `member-${sessionId}`,
    label: sessionId,
    successCodes: [0],
  }
}

test('a user-killed terminal never reports success', async () => {
  const sessionId = 'kill-semantics'
  const promise = terminalService.runTerminal(
    terminalOptions(sessionId, "trap 'exit 0' TERM; while true; do sleep 1; done"),
  )
  await new Promise((resolve) => setTimeout(resolve, 100))
  const terminal = terminalService.listSessionTerminals(sessionId)[0]
  assert.ok(terminal)
  assert.equal(terminalService.killTerminal(terminal.id), true)
  const result = await promise
  assert.equal(result.ok, false)
  assert.equal(result.error?.code, 'KILLED')
  assert.equal(terminalService.listSessionTerminals(sessionId)[0].status, 'killed')
})

test('natural exit removes the persisted session PID', async () => {
  const sessionId = 'pid-cleanup'
  const result = await terminalService.runTerminal(terminalOptions(sessionId, 'exit 0'))
  assert.equal(result.ok, true)
  const pidFile = path.join(dataRoot, 'console', `session_${sessionId}.pids`)
  assert.equal(fs.existsSync(pidFile), false)
})

test('attach flushes pending output before sending its snapshot', async () => {
  const sessionId = 'attach-order'
  const events = []
  const ws = {
    readyState: 1,
    send(raw) {
      events.push(JSON.parse(raw))
    },
  }
  bus.subscribe(sessionId, ws)
  const promise = terminalService.runTerminal(
    terminalOptions(sessionId, 'sleep 0.05; printf UNIQUE_ATTACH_TOKEN; sleep 0.1'),
  )

  let attached = false
  for (let i = 0; i < 300; i++) {
    const terminal = terminalService.listSessionTerminals(sessionId, { includeReplay: true })[0]
    if (terminal?.replay.includes('UNIQUE_ATTACH_TOKEN')) {
      terminalService.handleTerminalClientMessage(
        ws,
        sessionId,
        JSON.stringify({ type: 'terminal.attach', terminalId: terminal.id }),
      )
      attached = true
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 1))
  }
  await promise
  bus.unsubscribe(ws)

  assert.equal(attached, true)
  const snapshot = events.find((event) => event.type === 'terminal.snapshot')
  const snapshotSeq = Number(snapshot?.payload?.seq || 0)
  const duplicateAfterSnapshot = events.some(
    (event) =>
      event.type === 'terminal.output' &&
      Number(event.payload?.seq || 0) > snapshotSeq &&
      String(event.payload?.data || '').includes('UNIQUE_ATTACH_TOKEN'),
  )
  assert.equal(duplicateAfterSnapshot, false)
})

test('keepAlive terminals resolve immediately and stay running', async () => {
  const sessionId = 'keepalive-shell'
  const started = Date.now()
  const promise = terminalService.runTerminal({
    ...terminalOptions(sessionId, 'echo READY; exec sleep 20', 800),
    keepAlive: true,
  })
  const result = await promise
  assert.ok(Date.now() - started < 2000)
  assert.equal(result.ok, true)
  assert.equal(result.keepAlive, true)
  const terminal = terminalService.listSessionTerminals(sessionId)[0]
  assert.equal(terminal.status, 'running')
  assert.equal(terminalService.killTerminal(terminal.id), true)
})

test('openTerminalLog points at the session log file', async () => {
  const sessionId = 'log-download'
  await terminalService.runTerminal(terminalOptions(sessionId, 'printf LOGTOKEN'))
  const terminal = terminalService.listSessionTerminals(sessionId)[0]
  const opened = terminalService.openTerminalLog(terminal.id, sessionId)
  assert.ok(!opened.error, opened.error)
  const text = fs.readFileSync(opened.path, 'utf8')
  assert.match(text, /LOGTOKEN/)
})

