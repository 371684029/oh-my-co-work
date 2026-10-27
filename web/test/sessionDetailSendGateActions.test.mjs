import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionDetailSendGateActions } from '../src/views/workbench/composables/sessionDetailSendGateActions.js'

function fakeDeps(gateActionsRef = {}) {
  return {
    sending: { value: false },
    uploading: { value: false },
    gating: { value: false },
    activeId: { value: null },
    sessions: { value: [] },
    members: { value: [] },
    slashCommands: { value: [] },
    pendingFiles: { value: [] },
    pendingGate: { value: null },
    filteredSlashCmds: { value: [] },
    readSenderText: () => '',
    clearSender: () => {},
    loadLists: async () => {},
    selectSession: async () => {},
    loadDetail: async () => {},
    runSlash: async () => {},
    composerHistIndexRef: { index: -1 },
    gateActionsRef,
    api: { sessions: { gate: async () => ({}) } },
  }
}

test('createSessionDetailSendGateActions returns the expected action keys', () => {
  const actions = createSessionDetailSendGateActions(fakeDeps())
  const expected = [
    'onSenderSubmit',
    'submitHuman',
    'approveSessionStart',
    'gate',
    'answerAdapterQuestion',
    'nextIdempotencyKey',
  ]
  for (const key of expected) {
    assert.equal(typeof actions[key], 'function', key)
  }
  assert.deepEqual(Object.keys(actions).sort(), [...expected].sort())
})

test('send-gate wiring fills gateActionsRef after message-send creation (two-phase)', () => {
  const gateActionsRef = {}
  const actions = createSessionDetailSendGateActions(fakeDeps(gateActionsRef))
  assert.equal(typeof gateActionsRef.submitHuman, 'function')
  assert.equal(typeof gateActionsRef.approveSessionStart, 'function')
  assert.equal(typeof gateActionsRef.gate, 'function')
  assert.equal(typeof gateActionsRef.answerAdapterQuestion, 'function')
  assert.equal(gateActionsRef.submitHuman, actions.submitHuman)
})

test('nextIdempotencyKey is a callable function', () => {
  const actions = createSessionDetailSendGateActions(fakeDeps())
  assert.equal(typeof actions.nextIdempotencyKey, 'function')
  const key = actions.nextIdempotencyKey('submit', 'n1')
  assert.equal(typeof key, 'string')
  assert.ok(key.length > 0)
})
