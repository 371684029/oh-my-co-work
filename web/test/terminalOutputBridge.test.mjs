import test from 'node:test'
import assert from 'node:assert/strict'
import {
  terminalOutputAppend,
  terminalOutputClearAll,
  terminalOutputGetReplay,
  terminalOutputSubscribe,
} from '../src/composables/terminalOutputBridge.js'

test('terminalOutputAppend notifies without full replay in payload', () => {
  terminalOutputClearAll()
  const seen = []
  const off = terminalOutputSubscribe('t1', (p) => seen.push(p))
  terminalOutputAppend('t1', { seq: 1, data: 'hi' })
  off()
  assert.equal(seen.length, 1)
  assert.equal(seen[0].data, 'hi')
  assert.equal('replay' in seen[0], false)
  assert.equal(terminalOutputGetReplay('t1'), 'hi')
})
