import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isSkippedFlowGroupExpanded,
  nextSkippedFlowGroupExpansion,
} from '../src/views/workbench/composables/sessionFlowNavUi.js'

test('skipped flow group expand toggles by entry key', () => {
  const store = { expandedSkippedFlowGroups: { g1: true } }
  const entry = { key: 'g1' }
  assert.equal(isSkippedFlowGroupExpanded(store, entry), true)
  assert.deepEqual(nextSkippedFlowGroupExpansion(store, entry), { g1: false })
  assert.deepEqual(nextSkippedFlowGroupExpansion(store, { key: 'g2' }), { g1: true, g2: true })
})
