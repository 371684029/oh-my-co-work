import assert from 'node:assert/strict'
import test from 'node:test'

test('terminalRun exports runTerminalPty', async () => {
  const mod = await import('../src/terminal/terminalRun.js')
  assert.equal(typeof mod.runTerminalPty, 'function')
})

test('runTerminalPty rejects missing sessionId', async () => {
  const { runTerminalPty } = await import('../src/terminal/terminalRun.js')
  const result = await runTerminalPty(
    { terminals: new Map(), killTerminal: () => {} },
    { launch: { cmd: 'echo', args: ['hi'] }, cwd: process.cwd(), sessionId: null },
  )
  assert.equal(result.ok, false)
  assert.equal(result.error?.code, 'TERMINAL_SESSION_REQUIRED')
})
