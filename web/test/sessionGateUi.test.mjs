import assert from 'node:assert/strict'
import test from 'node:test'
import { isPendingGateMessage } from '../src/views/workbench/composables/sessionGateUi.js'

test('isPendingGateMessage filters archive confirm and adapter answers', () => {
  assert.equal(
    isPendingGateMessage({ type: 'gate', content: { mode: 'archive_confirm' } }, []),
    false,
  )
  assert.equal(
    isPendingGateMessage(
      { type: 'gate', content: { mode: 'adapter_question', humanAction: 'pending' } },
      [],
    ),
    true,
  )
  assert.equal(
    isPendingGateMessage(
      { type: 'gate', content: { mode: 'adapter_question', humanAction: 'pending', answered: true } },
      [],
    ),
    false,
  )
})

test('isPendingGateMessage follows node waiting_human', () => {
  const nodes = [{ id: 'n1', status: 'waiting_human' }]
  assert.equal(
    isPendingGateMessage({ type: 'gate', node_instance_id: 'n1', content: {} }, nodes),
    true,
  )
  assert.equal(
    isPendingGateMessage({ type: 'gate', node_instance_id: 'n1', content: {} }, [
      { id: 'n1', status: 'succeeded' },
    ]),
    false,
  )
})
