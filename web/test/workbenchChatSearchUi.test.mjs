import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canRunChatSearch,
  nextChatSearchSeq,
  shouldApplyChatSearchResponse,
} from '../src/views/workbench/composables/workbenchChatSearchUi.js'
import { shouldClearActiveSessionAfterDelete, workbenchPathAfterDelete } from '../src/views/workbench/composables/sessionDeleteNavUi.js'

test('chat search seq and apply guard', () => {
  assert.equal(nextChatSearchSeq(0), 1)
  assert.equal(shouldApplyChatSearchResponse(2, 2), true)
  assert.equal(shouldApplyChatSearchResponse(1, 2), false)
  assert.equal(canRunChatSearch(' hi ', 's1'), true)
  assert.equal(canRunChatSearch('  ', 's1'), false)
})

test('session delete navigation', () => {
  assert.equal(shouldClearActiveSessionAfterDelete('a', 'a'), true)
  assert.equal(shouldClearActiveSessionAfterDelete('a', 'b'), false)
  assert.equal(workbenchPathAfterDelete('a', 'a'), '/workbench')
  assert.equal(workbenchPathAfterDelete('a', 'b'), null)
})
