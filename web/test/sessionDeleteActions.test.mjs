import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionDeleteActions } from '../src/views/workbench/composables/sessionDeleteActions.js'

test('createSessionDeleteActions exposes doDelete', () => {
  const actions = createSessionDeleteActions({
    activeId: { value: '' },
    detail: { value: null },
    loadLists: async () => {},
    api: { sessions: { remove: async () => {} } },
    acwConfirm: async () => false,
    terminalBridge: {},
    leaveWorkbench: () => {},
  })
  assert.equal(typeof actions.doDelete, 'function')
})
