import test from 'node:test'
import assert from 'node:assert/strict'
import {
  shouldCopyInsteadOfInterrupt,
  formatTerminalCopyText,
} from '../src/composables/terminalClipboard.js'

test('copy when selection exists on Ctrl+C', () => {
  const xterm = { hasSelection: () => true }
  const ev = { type: 'keydown', key: 'c', ctrlKey: true, shiftKey: false, metaKey: false, altKey: false }
  assert.equal(shouldCopyInsteadOfInterrupt(xterm, ev, { platform: 'Win32' }), true)
})

test('formatTerminalCopyText strips ansi and trailing spaces', () => {
  const raw = 'hello   \n\u001b[31mworld\u001b[0m  \n\n\n'
  assert.equal(formatTerminalCopyText(raw), 'hello\nworld')
})

test('interrupt when no selection', () => {
  const xterm = { hasSelection: () => false }
  const ev = { type: 'keydown', key: 'c', ctrlKey: true, shiftKey: false, metaKey: false, altKey: false }
  assert.equal(shouldCopyInsteadOfInterrupt(xterm, ev, { platform: 'Win32' }), false)
})
