import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSessionGateBody } from '../src/views/workbench/composables/sessionGateRequestUi.js'

test('buildSessionGateBody omits empty text and optional fields', () => {
  assert.deepEqual(
    buildSessionGateBody({
      action: 'approve',
      text: '   ',
      nodeInstanceId: '',
      idempotencyKey: 'k1',
    }),
    { action: 'approve', idempotencyKey: 'k1' },
  )
  assert.deepEqual(
    buildSessionGateBody({
      action: 'submit',
      text: ' hello ',
      nodeInstanceId: 'n-1',
      idempotencyKey: 'k2',
    }),
    { action: 'submit', idempotencyKey: 'k2', text: 'hello', nodeInstanceId: 'n-1' },
  )
  assert.deepEqual(
    buildSessionGateBody({
      action: 'adapter_answer',
      choice: 'yes',
      questionId: 'q1',
      idempotencyKey: 'k3',
    }),
    { action: 'adapter_answer', idempotencyKey: 'k3', questionId: 'q1', choice: 'yes' },
  )
})
