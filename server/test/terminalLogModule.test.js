import assert from 'node:assert/strict'
import test from 'node:test'

test('terminalLog module exports log helpers', async () => {
  const mod = await import('../src/terminal/terminalLog.js')
  assert.equal(typeof mod.readTerminalLogPath, 'function')
  assert.equal(typeof mod.readTerminalLogPreview, 'function')
  assert.equal(typeof mod.deleteTerminalLogForEntry, 'function')
})
