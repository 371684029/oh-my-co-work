import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionComposerKeydownActions } from '../src/views/workbench/composables/sessionComposerKeydownActions.js'

test('createSessionComposerKeydownActions exposes onComposerKeydown', () => {
  const actions = createSessionComposerKeydownActions({
    activeId: { value: '' },
    readSenderText: () => '',
    readSenderTextRaw: () => '',
    replaceSenderText: async () => {},
    composerHistIndexRef: { index: -1 },
    filteredHashItems: { value: [] },
    filteredAtMembers: { value: [] },
    filteredSlashCmds: { value: [] },
    syncSlashFromInput: () => {},
    syncAtFromInput: () => {},
    syncHashFromInput: () => {},
    insertAtMember: async () => {},
    insertHashItem: async () => {},
    runSlash: async () => {},
  })
  assert.equal(typeof actions.onComposerKeydown, 'function')
})
