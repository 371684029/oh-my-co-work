import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionDetailComposerActions } from '../src/views/workbench/composables/sessionDetailComposerActions.js'

function fakeDeps() {
  return {
    activeId: { value: null },
    api: { slashCommands: { run: async () => ({}) } },
    readSenderText: () => '',
    readSenderTextRaw: () => '',
    replaceSenderText: async () => {},
    appendSenderText: () => {},
    clearSender: () => {},
    hashInsertLockUntilRef: { until: 0 },
    composerDraftTimerRef: { id: 0 },
    composerHistIndexRef: { index: -1 },
    filteredSlashCmds: { value: [] },
    filteredAtMembers: { value: [] },
    filteredHashItems: { value: [] },
  }
}

test('createSessionDetailComposerActions returns the expected action keys', () => {
  const actions = createSessionDetailComposerActions(fakeDeps())
  const expected = [
    'copyComposerText',
    'syncSlashFromInput',
    'syncAtFromInput',
    'syncHashFromInput',
    'onSenderChange',
    'toggleSlashPanel',
    'closeComposerPanel',
    'toggleAtPanel',
    'toggleHashPanel',
    'insertAtMember',
    'insertHashItem',
    'runSlash',
    'onComposerKeydown',
  ]
  for (const key of expected) {
    assert.equal(typeof actions[key], 'function', key)
  }
  assert.deepEqual(Object.keys(actions).sort(), [...expected].sort())
})
