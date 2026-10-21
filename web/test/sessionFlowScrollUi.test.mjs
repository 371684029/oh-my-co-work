import assert from 'node:assert/strict'
import test from 'node:test'
import { createFlowScrollToAnchor } from '../src/views/workbench/composables/sessionFlowScrollUi.js'

test('createFlowScrollToAnchor exposes scroll helpers', () => {
  const timerRef = { id: 0 }
  const api = createFlowScrollToAnchor({
    getAnchorNodeId: () => null,
    isFlowTabActive: () => false,
    timerRef,
  })
  assert.equal(typeof api.scrollFlowToAnchor, 'function')
  assert.equal(typeof api.clearFlowScrollTimer, 'function')
  api.scrollFlowToAnchor()
})
