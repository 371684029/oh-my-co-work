import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionNodePresentation } from '../src/views/workbench/composables/sessionNodePresentation.js'

test('createSessionNodePresentation exposes node helpers', () => {
  const p = createSessionNodePresentation({
    detail: { value: null },
    members: { value: [] },
    getActiveOffsiteNodeId: () => null,
    getOffsiteMode: () => 'planned',
  })
  assert.equal(p.isPendingGate({}), false)
  assert.equal(typeof p.flowClass, 'function')
})
