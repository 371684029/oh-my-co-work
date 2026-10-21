import assert from 'node:assert/strict'
import test from 'node:test'
import {
  terminalViewCtxCopy,
  terminalViewProcessEnded,
} from '../src/composables/terminalViewCopy.js'

test('terminalViewCopy context menu', () => {
  assert.match(terminalViewCtxCopy(), /复制|Copy/)
  assert.match(terminalViewProcessEnded(), /进程|Process|input/i)
})
