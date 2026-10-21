import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldCopyInsteadOfInterrupt } from '../src/composables/terminalClipboard.js'

test('copy when selection exists on Ctrl+C', () => {
  const xterm = { hasSelection: () => true }
  const ev = { type: 'keydown', key: 'c', ctrlKey: true, shiftKey: false, metaKey: false, altKey: false }
  assert.equal(shouldCopyInsteadOfInterrupt(xterm, ev, { platform: 'Win32' }), true)
})

test('interrupt when no selection', () => {
  const xterm = { hasSelection: () => false }
  const ev = { type: 'keydown', key: 'c', ctrlKey: true, shiftKey: false, metaKey: false, altKey: false }
  assert.equal(shouldCopyInsteadOfInterrupt(xterm, ev, { platform: 'Win32' }), false)
})
