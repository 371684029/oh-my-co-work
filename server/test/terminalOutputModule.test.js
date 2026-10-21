import assert from 'node:assert/strict'
import test from 'node:test'

test('terminalOutput module exports queue helpers', async () => {
  const mod = await import('../src/terminal/terminalOutput.js')
  assert.equal(typeof mod.queueOutput, 'function')
  assert.equal(typeof mod.flushOutput, 'function')
  assert.equal(mod.OUTPUT_BATCH_MS, 24)
})
