import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionFlowAnchorComputeds } from '../src/views/workbench/composables/sessionFlowAnchorComputeds.js'

test('createSessionFlowAnchorComputeds exposes flow anchor helpers', () => {
  const c = createSessionFlowAnchorComputeds({
    detail: { value: null },
    getActiveOffsiteId: () => null,
    flowScrollTimerRef: { id: 0 },
  })
  assert.equal(c.flowEntries.value.length, 0)
  assert.equal(typeof c.scrollFlowToAnchor, 'function')
})
