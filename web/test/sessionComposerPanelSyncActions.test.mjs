import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionComposerPanelSyncActions } from '../src/views/workbench/composables/sessionComposerPanelSyncActions.js'

test('createSessionComposerPanelSyncActions exposes sync handlers', () => {
  const actions = createSessionComposerPanelSyncActions({
    activeId: { value: '' },
    readSenderText: () => '',
    readSenderTextRaw: () => '',
    hashInsertLockUntilRef: { until: 0 },
    draftTimerRef: { id: 0 },
  })
  assert.equal(typeof actions.syncSlashFromInput, 'function')
  assert.equal(typeof actions.onSenderChange, 'function')
})
