import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionNotesActions } from '../src/views/workbench/composables/sessionNotesActions.js'

test('createSessionNotesActions exposes saveSessionNotes', () => {
  const actions = createSessionNotesActions({
    activeId: { value: '' },
    sessionNotesDraft: { value: '' },
    detail: { value: null },
    notesSaving: { value: false },
    api: { sessions: {} },
  })
  assert.equal(typeof actions.saveSessionNotes, 'function')
})
