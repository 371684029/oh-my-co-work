import assert from 'node:assert/strict'
import test from 'node:test'
import { cyclePickerIndex } from '../src/views/workbench/composables/sessionComposerPickerUi.js'

test('cyclePickerIndex wraps', () => {
  assert.equal(cyclePickerIndex(0, 1, 3), 1)
  assert.equal(cyclePickerIndex(0, -1, 3), 2)
  assert.equal(cyclePickerIndex(0, 1, 0), 0)
})
