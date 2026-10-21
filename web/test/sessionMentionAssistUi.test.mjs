import assert from 'node:assert/strict'
import test from 'node:test'
import { composerMentionAssistOnly } from '../src/views/workbench/composables/sessionMentionAssistUi.js'

test('composerMentionAssistOnly', () => {
  const members = [{ name: 'bob', display_name: 'Bob' }]
  assert.equal(composerMentionAssistOnly('@Bob', members), true)
  assert.equal(composerMentionAssistOnly('hi', members), false)
})
