import assert from 'node:assert/strict'
import test from 'node:test'
import { reviewAction, reviewLabel } from '../src/views/workbench/composables/sessionReviewUi.js'

test('reviewAction and reviewLabel', () => {
  assert.equal(reviewAction({ output: { humanAction: 'approve' } }), 'approve')
  assert.equal(reviewLabel({ output: { humanAction: 'approve' } }), '通过')
  assert.equal(reviewAction({ status: 'waiting_human' }), 'pending')
  assert.equal(reviewLabel({ status: 'waiting_human' }), 'pending')
  assert.equal(reviewAction({ status: 'succeeded' }), '')
})
