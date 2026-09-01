import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

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

test('same-member keepAlive can replace an existing terminal under quota', async () => {
  const sessionId = 'quota-replace-same-member'
  const settingsPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../config/app-settings.json')
  const orig = fs.readFileSync(settingsPath, 'utf8')
  try {
    const json = JSON.parse(orig)
    json.quota = { ...(json.quota || {}), maxConcurrentTerminals: 1 }
    fs.writeFileSync(settingsPath, JSON.stringify(json, null, 2))

    const first = await terminalService.runTerminal({
      ...terminalOptions(sessionId, 'echo FIRST; exec sleep 20'),
      keepAlive: true,
      memberId: 'same-member',
    })
    assert.equal(first.ok, true)
    const second = await terminalService.runTerminal({
      ...terminalOptions(sessionId, 'echo SECOND; exec sleep 20'),
      keepAlive: true,
      memberId: 'same-member',
    })
    assert.equal(second.ok, true)
    const running = terminalService
      .listSessionTerminals(sessionId)
      .filter((t) => t.status === 'running' || t.status === 'starting')
    assert.equal(running.length, 1)
    assert.equal(running[0].id, second.terminalId)
    assert.equal(terminalService.killTerminal(second.terminalId), true)
  } finally {
    fs.writeFileSync(settingsPath, orig)
  }
})

test('quota still blocks a different member when the session is full', async () => {
  const sessionId = 'quota-block-other-member'
  const settingsPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../config/app-settings.json')
  const orig = fs.readFileSync(settingsPath, 'utf8')
  try {
    const json = JSON.parse(orig)
    json.quota = { ...(json.quota || {}), maxConcurrentTerminals: 1 }
    fs.writeFileSync(settingsPath, JSON.stringify(json, null, 2))

    const first = await terminalService.runTerminal({
      ...terminalOptions(sessionId, 'echo HOLD; exec sleep 20'),
      keepAlive: true,
      memberId: 'member-a',
    })
    assert.equal(first.ok, true)
    const second = await terminalService.runTerminal({
      ...terminalOptions(sessionId, 'echo OTHER; exec sleep 20'),
      keepAlive: true,
      memberId: 'member-b',
    })
    assert.equal(second.ok, false)
    assert.equal(second.error?.code, 'TERMINAL_QUOTA')
    assert.equal(terminalService.killTerminal(first.terminalId), true)
  } finally {
    fs.writeFileSync(settingsPath, orig)
  }
})

test('log files redact tokens while live replay stays raw', async () => {
  const sessionId = 'redact-log-only'
  const token = 'sk-abcdefghijklmnopqrstuvwxyz'
  const result = await terminalService.runTerminal(
    terminalOptions(sessionId, `printf '${token}\\nUNIQUE_REDACT_MARKER\\n'`),
  )
  assert.equal(result.ok, true)
  const terminal = terminalService.listSessionTerminals(sessionId, { includeReplay: true })[0]
  assert.ok(terminal.replay.includes(token))
  assert.ok(terminal.replay.includes('UNIQUE_REDACT_MARKER'))
  const logPath = path.join(dataRoot, 'logs', terminal.log)
  // 日志按 OUTPUT_BATCH_MS 批量落盘；轮询等待最后一拍写入，避免与刷盘竞态
  let logText = ''
  for (let i = 0; i < 80; i++) {
    logText = fs.readFileSync(logPath, 'utf8')
    if (logText.includes('UNIQUE_REDACT_MARKER')) break
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  assert.equal(logText.includes(token), false)
  assert.match(logText, /\[REDACTED\]/)
  assert.ok(logText.includes('UNIQUE_REDACT_MARKER'))
})

test('missing command marks failed and keeps the error in replay', async () => {
  const sessionId = 'missing-cmd'
  const result = await terminalService.runTerminal({
    launch: { cmd: 'definitely-not-a-binary-acw-xyz', args: [], shell: false, label: 'missing' },
    cwd: process.cwd(),
    env: { ...process.env },
    sessionId,
    memberId: 'm-missing',
    label: 'missing',
    successCodes: [0],
  })
  assert.equal(result.ok, false)
  const terminal = terminalService.listSessionTerminals(sessionId)[0]
  assert.ok(['failed', 'exited'].includes(terminal.status))
  assert.ok(terminal.lastError || Number(terminal.exitCode) !== 0)
})

test('resolveWindowsExecutable leaves non-Windows launches untouched', () => {
  assert.equal(
    terminalService.resolveWindowsExecutable('grok', { platform: 'linux' }),
    'grok',
  )
  assert.equal(
    terminalService.resolveWindowsExecutable('grok', { platform: 'darwin' }),
    'grok',
  )
})

test('resolveWindowsExecutable skips lookup for paths that already contain a separator', () => {
  const run = () => {
    throw new Error('should not call `where` for an already-resolved path')
  }
  assert.equal(
    terminalService.resolveWindowsExecutable('C:\\Program Files\\grok\\grok.exe', {
      platform: 'win32',
      run,
    }),
    'C:\\Program Files\\grok\\grok.exe',
  )
})

test('resolveWindowsExecutable resolves a bare command to the first `where` match, extension and all', () => {
  const calls = []
  const run = (cmd, args) => {
    calls.push([cmd, args])
    return { status: 0, stdout: 'C:\\Users\\a\\AppData\\Roaming\\npm\\grok.cmd\r\nC:\\other\\grok.cmd\r\n' }
  }
  const resolved = terminalService.resolveWindowsExecutable('grok', { platform: 'win32', run })
  assert.equal(resolved, 'C:\\Users\\a\\AppData\\Roaming\\npm\\grok.cmd')
  assert.deepEqual(calls, [['where', ['grok']]])
})

test('resolveWindowsExecutable falls back to the bare command when `where` finds nothing', () => {
  const run = () => ({ status: 1, stdout: '' })
  assert.equal(
    terminalService.resolveWindowsExecutable('grok-not-installed', { platform: 'win32', run }),
    'grok-not-installed',
  )
})

test('resolveWindowsExecutable falls back to the bare command when `where` throws', () => {
  const run = () => {
    throw new Error('where not found')
  }
  assert.equal(
    terminalService.resolveWindowsExecutable('grok', { platform: 'win32', run }),
    'grok',
  )
})

test('normalizePtyLaunch on win32 actually wires through resolveWindowsExecutable (not just tested in isolation)', () => {
  const calls = []
  const resolveExecutable = (cmd, opts) => {
    calls.push([cmd, opts])
    return 'C:\\Users\\a\\AppData\\Roaming\\npm\\grok.cmd'
  }
  const spec = terminalService.normalizePtyLaunch(
    { cmd: 'grok', args: ['--prompt', 'hi'], shell: false },
    { platform: 'win32', resolveExecutable },
  )
  assert.equal(spec.file, 'C:\\Users\\a\\AppData\\Roaming\\npm\\grok.cmd')
  assert.deepEqual(spec.args, ['--prompt', 'hi'])
  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], 'grok')
  assert.equal(calls[0][1].platform, 'win32')
})

test('normalizePtyLaunch delegates to the real resolveWindowsExecutable by default, which no-ops off win32', () => {
  // 不传 resolveExecutable：走生产默认值 resolveWindowsExecutable，它自己会按
  // platform 判断要不要发起 `where` 查找；非 win32 时应该原样返回，不抛错。
  const spec = terminalService.normalizePtyLaunch(
    { cmd: 'grok', args: [], shell: false },
    { platform: 'linux' },
  )
  assert.equal(spec.file, 'grok')
})

test('normalizePtyLaunch shell mode picks cmd.exe on win32 and $SHELL elsewhere, independent of resolveExecutable', () => {
  const winSpec = terminalService.normalizePtyLaunch(
    { cmd: 'echo hi', shell: true },
    { platform: 'win32' },
  )
  assert.equal(winSpec.file, process.env.ComSpec || 'cmd.exe')
  assert.deepEqual(winSpec.args, ['/d', '/s', '/c', 'echo hi'])

  const unixSpec = terminalService.normalizePtyLaunch(
    { cmd: 'echo hi', shell: true },
    { platform: 'linux' },
  )
  assert.equal(unixSpec.file, process.env.SHELL || '/bin/sh')
  assert.deepEqual(unixSpec.args, ['-lc', 'echo hi'])
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

