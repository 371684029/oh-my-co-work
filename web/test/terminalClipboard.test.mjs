import test from 'node:test'
import assert from 'node:assert/strict'
import {
  shouldCopyInsteadOfInterrupt,
  formatTerminalCopyText,
  isCopyForceShortcut,
  isPasteShortcut,
  shouldHandlePasteShortcut,
  createFurnaceInterruptGuard,
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

test('createFurnaceInterruptGuard requires double press within window to interrupt', () => {
  let currentTime = 1000
  const guard = createFurnaceInterruptGuard({ windowMs: 1500, now: () => currentTime })

  // First press: intercepted to prevent accidental exit
  const first = guard.check()
  assert.equal(first.allowInterrupt, false)
  assert.equal(first.isFirstAttempt, true)

  // Second press 500ms later: within 1500ms, allowed
  currentTime = 1500
  const second = guard.check()
  assert.equal(second.allowInterrupt, true)
  assert.equal(second.isFirstAttempt, false)

  // Third press after reset: treated as fresh first attempt
  currentTime = 2000
  const third = guard.check()
  assert.equal(third.allowInterrupt, false)
  assert.equal(third.isFirstAttempt, true)

  // Fourth press 2000ms later (> windowMs): expired, treated as first attempt
  currentTime = 4100
  const fourth = guard.check()
  assert.equal(fourth.allowInterrupt, false)
  assert.equal(fourth.isFirstAttempt, true)
})
