import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionRenameActions } from '../src/views/workbench/composables/sessionRenameActions.js'

test('createSessionRenameActions exposes rename', () => {
  const actions = createSessionRenameActions({
    activeId: { value: 's1' },
    editTitle: { value: 't' },
    sessions: { value: [] },
    api: { sessions: { rename: async () => {}, list: async () => [] } },
  })
  assert.equal(typeof actions.rename, 'function')
})
