import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionComposerPanelToggleActions } from '../src/views/workbench/composables/sessionComposerPanelToggleActions.js'

test('createSessionComposerPanelToggleActions exposes toggles', () => {
  const actions = createSessionComposerPanelToggleActions({
    readSenderText: () => '',
    readSenderTextRaw: () => '',
    appendSenderText: () => {},
    syncSlashFromInput: () => {},
    syncAtFromInput: () => {},
    syncHashFromInput: () => {},
  })
  assert.equal(typeof actions.toggleSlashPanel, 'function')
  assert.equal(typeof actions.closeComposerPanel, 'function')
})
