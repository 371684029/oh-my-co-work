import assert from 'node:assert/strict'
import test from 'node:test'
import {
  computeNeedsHuman,
  announceKickoffFromContext,
} from '../src/views/workbench/composables/sessionAttentionUi.js'

test('computeNeedsHuman respects session status and gate', () => {
  assert.equal(computeNeedsHuman({ status: 'archived' }, {}), false)
  assert.equal(computeNeedsHuman({ status: 'interrupted' }, null), true)
  assert.equal(computeNeedsHuman({ status: 'active' }, { type: 'gate' }), true)
})

test('announceKickoffFromContext', () => {
  assert.equal(announceKickoffFromContext({ kickoff: { text: ' hi ' } }), 'hi')
})
