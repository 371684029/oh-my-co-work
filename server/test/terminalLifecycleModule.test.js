import assert from 'node:assert/strict'
import test from 'node:test'

test('terminalLifecycle exports cleanup helpers', async () => {
  const mod = await import('../src/terminal/terminalLifecycle.js')
  assert.equal(typeof mod.killTerminalEntry, 'function')
  assert.equal(typeof mod.forgetSessionTerminalsInMap, 'function')
  assert.equal(typeof mod.pruneFinishedTerminals, 'function')
})
