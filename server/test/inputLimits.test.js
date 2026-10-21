import test from 'node:test'
import assert from 'node:assert/strict'
import { clampTerminalSize, MAX_INPUT_CHARS } from '../src/terminal/inputLimits.js'

test('MAX_INPUT_CHARS headroom for chunked paste', () => {
  assert.ok(MAX_INPUT_CHARS >= 65536)
})

test('clampTerminalSize floors and clamps', () => {
  assert.equal(clampTerminalSize(80.9, 40, 20, 300), 80)
  assert.equal(clampTerminalSize(999, 40, 20, 300), 300)
})
