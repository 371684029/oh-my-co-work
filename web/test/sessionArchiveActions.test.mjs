import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createSessionArchiveActions,
  shouldShowSessionDone,
} from '../src/views/workbench/composables/sessionArchiveActions.js'

test('shouldShowSessionDone hides archived sessions', () => {
  assert.equal(shouldShowSessionDone({ id: 's1', status: 'active' }), true)
  assert.equal(shouldShowSessionDone({ id: 's1', status: 'archived' }), false)
  assert.equal(shouldShowSessionDone(null), false)
})

test('createSessionArchiveActions exposes markSessionDone', () => {
  const actions = createSessionArchiveActions({
    activeId: { value: 's1' },
    detail: { value: { session: { status: 'active' } } },
    loadLists: async () => {},
    loadDetail: async () => {},
    api: { sessions: { archive: async () => {} } },
    acwConfirm: async () => false,
    terminalBridge: {},
  })
  assert.equal(typeof actions.markSessionDone, 'function')
})