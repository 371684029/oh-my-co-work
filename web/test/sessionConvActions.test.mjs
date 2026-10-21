import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionConvActions } from '../src/views/workbench/composables/sessionConvActions.js'

test('createSessionConvActions exposes conv handlers', () => {
  const actions = createSessionConvActions({
    sessions: { value: [] },
    detail: { value: null },
    activeId: { value: '' },
    editTitle: { value: '' },
    loadDetail: async () => {},
    api: { sessions: {} },
    deleteSessionRef: { doDelete: async () => {} },
  })
  assert.equal(typeof actions.togglePin, 'function')
  assert.equal(typeof actions.onConvMenu, 'function')
})
