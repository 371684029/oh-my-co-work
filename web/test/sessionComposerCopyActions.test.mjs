import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionComposerCopyActions } from '../src/views/workbench/composables/sessionComposerCopyActions.js'

test('createSessionComposerCopyActions exposes copyComposerText', () => {
  const actions = createSessionComposerCopyActions({ readSenderText: () => '' })
  assert.equal(typeof actions.copyComposerText, 'function')
})
