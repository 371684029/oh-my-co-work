import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionDetailLifecycleActions } from '../src/views/workbench/composables/sessionDetailLifecycleActions.js'

function fakeDeps() {
  return {
    sessions: { value: [] },
    groups: { value: [] },
    members: { value: [] },
    slashCommands: { value: [] },
    startTarget: { value: '' },
    startingChat: { value: false },
    terminalPrefs: { value: {} },
    furnaceSurface: { value: 'tui' },
    detail: { value: null },
    editTitle: { value: '' },
    sessionNotesDraft: { value: '' },
    activeId: { value: null },
    gating: { value: false },
    api: {
      sessions: { list: async () => [], get: async () => ({}) },
      groups: { list: async () => [] },
      members: { list: async () => [] },
      slashCommands: { list: async () => ({}) },
      appSettings: { get: async () => ({}) },
    },
    terminalBridge: {},
    acwConfirm: async () => false,
    readSenderTextRaw: () => '',
    replaceSenderText: async () => {},
    composerHistIndexRef: { index: -1 },
    getRouter: () => null,
    offsiteActive: { value: false },
    scrollFlowToAnchor: () => {},
    deleteSessionRef: { doDelete: async () => {} },
  }
}

test('createSessionDetailLifecycleActions returns the expected action keys', () => {
  const actions = createSessionDetailLifecycleActions(fakeDeps())
  const expected = [
    'loadLists',
    'loadDetail',
    'selectSession',
    'openDocsHub',
    'onConvChange',
    'doDelete',
    'rename',
    'togglePin',
    'onConvMenu',
    'startChat',
    'startDemoChat',
    'restartFromNode',
    'goShortcuts',
  ]
  for (const key of expected) {
    assert.equal(typeof actions[key], 'function', key)
  }
  assert.deepEqual(Object.keys(actions).sort(), [...expected].sort())
})

test('lifecycle wiring fills deleteSessionRef.doDelete (two-phase)', () => {
  const deps = fakeDeps()
  const actions = createSessionDetailLifecycleActions(deps)
  assert.equal(deps.deleteSessionRef.doDelete, actions.doDelete)
})

test('onConvChange ignores empty items and resolves uniqueKey first', () => {
  const actions = createSessionDetailLifecycleActions(fakeDeps())
  assert.equal(actions.onConvChange(null), undefined)
  assert.equal(actions.onConvChange({}), undefined)
})

test('goShortcuts tolerates a null router', () => {
  const actions = createSessionDetailLifecycleActions(fakeDeps())
  assert.equal(actions.goShortcuts(), undefined)
})
