import test from 'node:test'
import assert from 'node:assert/strict'
import { copyVisibleTerminalText } from '../src/composables/terminalBufferUtils.js'

test('copyVisibleTerminalText returns empty without xterm', () => {
  assert.equal(copyVisibleTerminalText(null), '')
})
