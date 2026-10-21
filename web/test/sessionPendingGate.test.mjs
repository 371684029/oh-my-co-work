import assert from 'node:assert/strict'
import test from 'node:test'
import { findPendingGateMessage } from '../src/views/workbench/composables/sessionPendingGate.js'
import { isPendingGateMessage } from '../src/views/workbench/composables/sessionGateUi.js'

test('findPendingGateMessage prefers adapter_question gate', () => {
  const session = { status: 'active', current_step_index: 0, context: {} }
  const nodes = [{ id: 'n1', step_index: 0, status: 'running' }]
  const messages = [
    {
      type: 'gate',
      content: { mode: 'adapter_question', humanAction: 'pending' },
      node_instance_id: 'n1',
    },
  ]
  const gate = findPendingGateMessage(session, messages, nodes, (m) =>
    isPendingGateMessage(m, nodes),
  )
  assert.equal(gate?.content?.mode, 'adapter_question')
})

test('findPendingGateMessage returns null for archived session', () => {
  assert.equal(
    findPendingGateMessage({ status: 'archived' }, [], [], () => true),
    null,
  )
})
