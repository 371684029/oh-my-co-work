import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionLoadActions } from '../src/views/workbench/composables/sessionLoadActions.js'

test('createSessionLoadActions exposes load/select handlers', () => {
  const actions = createSessionLoadActions({
    sessions: { value: [] },
    groups: { value: [] },
    members: { value: [] },
    slashCommands: { value: [] },
    startTarget: { value: '' },
    terminalPrefs: { value: {} },
    furnaceSurface: { value: 'tui' },
    detail: { value: null },
    editTitle: { value: '' },
    sessionNotesDraft: { value: '' },
    activeId: { value: '' },
    api: {
      sessions: { list: async () => [], get: async () => ({ session: { title: 't' } }) },
      groups: { list: async () => [] },
      members: { list: async () => [] },
      slashCommands: { list: async () => ({ commands: [] }) },
      appSettings: { get: async () => ({}) },
    },
    terminalBridge: {},
    readSenderTextRaw: () => '',
    replaceSenderText: async () => {},
    composerHistIndexRef: { index: -1 },
    replaceSessionRoute: () => {},
  })
  assert.equal(typeof actions.loadLists, 'function')
  assert.equal(typeof actions.loadDetail, 'function')
  assert.equal(typeof actions.selectSession, 'function')
})
