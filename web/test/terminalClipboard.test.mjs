import test from 'node:test'
import assert from 'node:assert/strict'
import {
  shouldCopyInsteadOfInterrupt,
  formatTerminalCopyText,
  isCopyForceShortcut,
  isPasteShortcut,
  shouldHandlePasteShortcut,
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

test('Ctrl+Shift+C always copies on mac and win', () => {
  const ev = { key: 'c', ctrlKey: true, shiftKey: true, metaKey: false, altKey: false }
  assert.equal(isCopyForceShortcut(ev, 'Win32'), true)
  const mac = { key: 'c', ctrlKey: false, shiftKey: true, metaKey: true, altKey: false }
  assert.equal(isCopyForceShortcut(mac, 'MacIntel'), true)
})

test('Ctrl+Shift+V is paste shortcut', () => {
  const ev = { key: 'v', ctrlKey: true, shiftKey: true, metaKey: false, altKey: false }
  assert.equal(shouldHandlePasteShortcut(ev, 'Win32'), true)
})
