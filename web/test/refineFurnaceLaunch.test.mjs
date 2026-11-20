import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildFurnaceLaunchQuery,
  memberVerifyFailedForLaunch,
  memberVerifyFailedFromRecord,
  normalizeRefineFurnaceTarget,
  decideFurnaceProcess,
  parseFurnaceLaunchQuery,
} from '../src/composables/refineFurnaceLaunch.js'

test('normalizeRefineFurnaceTarget defaults to grok', () => {
  assert.equal(normalizeRefineFurnaceTarget(''), 'grok')
  assert.equal(normalizeRefineFurnaceTarget('cursor'), 'cursor')
  assert.equal(normalizeRefineFurnaceTarget('bogus'), 'grok')
})

test('parseFurnaceLaunchQuery reads workbench deep link', () => {
  const q = parseFurnaceLaunchQuery({ furnace: '1', agent: 'cursor', refineMemberId: 'm1' })
  assert.equal(q.openFurnace, true)
  assert.equal(q.agent, 'cursor')
  assert.equal(q.refineMemberId, 'm1')
})

test('buildFurnaceLaunchQuery omits empty fields', () => {
  assert.deepEqual(buildFurnaceLaunchQuery({ agent: 'grok', memberId: 'x', jump: true }), {
    furnace: '1',
    agent: 'grok',
    refineMemberId: 'x',
  })
})

test('decideFurnaceProcess continues the same member and restarts a different one', () => {
  assert.equal(
    decideFurnaceProcess({ live: true, seenMemberId: 'a', nextMemberId: 'a', hasUserTask: true }),
    'continue',
  )
  assert.equal(
    decideFurnaceProcess({ live: true, seenMemberId: 'a', nextMemberId: 'b', hasUserTask: true }),
    'confirm-restart',
  )
  assert.equal(
    decideFurnaceProcess({ live: true, seenMemberId: '', nextMemberId: 'b', hasUserTask: false }),
    'restart',
  )
  assert.equal(decideFurnaceProcess({ live: false, nextMemberId: 'b' }), 'start')
  assert.equal(decideFurnaceProcess({ live: true, nextMemberId: '' }), 'focus')
  assert.equal(decideFurnaceProcess({ live: false, nextMemberId: '' }), 'start-free')
})

test('memberVerifyFailedForLaunch', () => {
  assert.equal(memberVerifyFailedForLaunch({ _verifyFailed: true }), true)
  assert.equal(memberVerifyFailedForLaunch({ _verifyLast: { ok: false } }), true)
  assert.equal(memberVerifyFailedForLaunch({ _verifyLast: { ok: true } }), false)
})

test('memberVerifyFailedFromRecord', () => {
  assert.equal(memberVerifyFailedFromRecord({ verifyFailed: true }), true)
  assert.equal(memberVerifyFailedFromRecord({ verifyLast: { ok: false } }), true)
  assert.equal(memberVerifyFailedFromRecord({ verifyLast: { ok: true } }), false)
})