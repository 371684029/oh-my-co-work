import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionComposerInsertActions } from '../src/views/workbench/composables/sessionComposerInsertActions.js'

test('createSessionComposerInsertActions exposes insert handlers', () => {
  const actions = createSessionComposerInsertActions({
    readSenderText: () => '',
    readSenderTextRaw: () => '',
    replaceSenderText: async () => {},
  })
  assert.equal(typeof actions.insertAtMember, 'function')
  assert.equal(typeof actions.insertHashItem, 'function')
})
