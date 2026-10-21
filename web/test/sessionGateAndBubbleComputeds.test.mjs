import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionGateAndBubbleComputeds } from '../src/views/workbench/composables/sessionGateAndBubbleComputeds.js'

test('createSessionGateAndBubbleComputeds exposes pendingGate and bubbleList', () => {
  const c = createSessionGateAndBubbleComputeds({
    detail: { value: null },
    terminalBridge: {},
    messageText: () => '',
    roleLabel: () => '',
    shortSender: () => '',
    isPendingGate: () => false,
    statusLabel: () => '',
  })
  assert.equal(c.pendingGate.value, null)
  assert.deepEqual(c.bubbleList.value, [])
})
