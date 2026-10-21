import assert from 'node:assert/strict'
import test from 'node:test'

const { isImeComposingEvent, shouldSkipPasteConfirmWhileComposing } = await import(
  '../src/composables/terminalIme.js'
)

test('isImeComposingEvent detects composition', () => {
  assert.equal(isImeComposingEvent({ isComposing: true }), true)
  assert.equal(isImeComposingEvent({ keyCode: 229 }), true)
  assert.equal(isImeComposingEvent({ key: 'Enter' }), false)
})

test('shouldSkipPasteConfirmWhileComposing', () => {
  assert.equal(shouldSkipPasteConfirmWhileComposing(true), true)
  assert.equal(shouldSkipPasteConfirmWhileComposing(false), false)
})
