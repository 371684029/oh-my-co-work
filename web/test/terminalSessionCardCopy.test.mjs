import assert from 'node:assert/strict'
import test from 'node:test'
import {
  terminalCardEnterTerminal,
  terminalCardElapsedSeconds,
} from '../src/composables/terminalSessionCardCopy.js'

test('terminalSessionCardCopy enter label', () => {
  assert.match(terminalCardEnterTerminal(), /进入终端|Enter terminal/)
})

test('terminalSessionCardCopy elapsed seconds', () => {
  assert.match(terminalCardElapsedSeconds(5), /5/)
})
