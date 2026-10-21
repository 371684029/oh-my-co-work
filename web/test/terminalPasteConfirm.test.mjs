import test from 'node:test'
import assert from 'node:assert/strict'
import {
  countPasteNewlines,
  shouldConfirmTerminalPaste,
  stripBracketedPasteMarkers,
} from '../src/composables/terminalPasteConfirm.js'

test('stripBracketedPasteMarkers removes bracket sequences for counting', () => {
  const raw = `\x1b[200~line1\nline2\x1b[201~`
  assert.equal(stripBracketedPasteMarkers(raw), 'line1\nline2')
  assert.equal(countPasteNewlines(raw), 1)
})

test('shouldConfirmTerminalPaste skips furnace agent context', () => {
  assert.equal(
    shouldConfirmTerminalPaste({
      data: 'a\nb\nc',
      pasteContext: 'furnace',
    }),
    false,
  )
})

test('shouldConfirmTerminalPaste respects single-line paste', () => {
  assert.equal(
    shouldConfirmTerminalPaste({ data: 'one line only', pasteContext: 'shell' }),
    false,
  )
})
