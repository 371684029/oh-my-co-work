import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionGateActions } from '../src/views/workbench/composables/sessionGateActions.js'

test('submitHuman delegates pure @ assist to message send', async () => {
  let sent = false
  let gated = false
  const gating = { value: false }
  const activeId = { value: 's1' }
  const members = { value: [{ name: 'alice', display_name: 'Alice' }] }
  const { submitHuman } = createSessionGateActions({
    gating,
    activeId,
    members,
    readSenderText: () => '@Alice',
    clearSender: () => {},
    loadDetail: async () => {},
    sessions: { value: [] },
    nextIdempotencyKey: () => 'k1',
    onSenderSubmit: async () => {
      sent = true
    },
    api: {
      sessions: {
        gate: async () => {
          gated = true
        },
      },
    },
  })
  await submitHuman({ node_instance_id: 'n1' })
  assert.equal(sent, true)
  assert.equal(gated, false)
})
