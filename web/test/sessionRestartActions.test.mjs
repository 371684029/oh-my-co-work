import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionRestartActions } from '../src/views/workbench/composables/sessionRestartActions.js'

test('createSessionRestartActions exposes restartFromNode', () => {
  const actions = createSessionRestartActions({
    activeId: { value: 's1' },
    detail: { value: { session: { status: 'active' } } },
    gating: { value: false },
    sessions: { value: [] },
    offsiteActive: { value: false },
    loadDetail: async () => {},
    api: { sessions: { restartFromNode: async () => ({}) } },
    scrollFlowToAnchor: () => {},
  })
  assert.equal(typeof actions.restartFromNode, 'function')
})
