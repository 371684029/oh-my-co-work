import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldSubmitOnEnter, isImeComposing } from '../src/composables/inputIntent.js'

test('shouldSubmitOnEnter respects shift and IME', () => {
  assert.equal(shouldSubmitOnEnter({ key: 'Enter', shiftKey: true }), false)
  assert.equal(shouldSubmitOnEnter({ key: 'Enter', isComposing: true }), false)
  assert.equal(isImeComposing({ keyCode: 229 }), true)
  assert.equal(shouldSubmitOnEnter({ key: 'Enter' }), true)
})
