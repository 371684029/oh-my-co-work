import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionFlowRailHandlers } from '../src/views/workbench/composables/sessionFlowRailHandlers.js'

test('createSessionFlowRailHandlers exposes flow rail handlers', () => {
  const h = createSessionFlowRailHandlers({
    getNodes: () => [],
    getHistorySplitIndex: () => 0,
  })
  assert.equal(typeof h.toggleSkippedFlowGroup, 'function')
  assert.equal(typeof h.isFlowHistoryNode, 'function')
})
