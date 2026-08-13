import assert from 'node:assert/strict'
import test from 'node:test'
import { isDiscardedUnexecutedFlowNode } from '@acw/shared'

test('collapses abandoned never-run nodes, not executed ones', () => {
  const cur = 9
  assert.equal(
    isDiscardedUnexecutedFlowNode(
      { step_type: 'offsite', status: 'succeeded', step_index: 0 },
      { currentStepIndex: cur, isCurrent: false },
    ),
    false,
  )
  assert.equal(
    isDiscardedUnexecutedFlowNode(
      { step_type: 'member', status: 'succeeded', step_index: 1 },
      { currentStepIndex: cur, isCurrent: false },
    ),
    false,
  )
  assert.equal(
    isDiscardedUnexecutedFlowNode(
      { step_type: 'archive', status: 'waiting_human', step_index: 4 },
      { currentStepIndex: cur, isCurrent: false },
    ),
    true,
  )
  assert.equal(
    isDiscardedUnexecutedFlowNode(
      { step_type: 'member', status: 'skipped', step_index: 5, output: { bypassed: true } },
      { currentStepIndex: cur, isCurrent: false },
    ),
    true,
  )
  assert.equal(
    isDiscardedUnexecutedFlowNode(
      { step_type: 'human', status: 'waiting_human', step_index: 9 },
      { currentStepIndex: cur, isCurrent: true },
    ),
    false,
  )
  assert.equal(
    isDiscardedUnexecutedFlowNode(
      { step_type: 'member', status: 'pending', step_index: 10 },
      { currentStepIndex: cur, isCurrent: false },
    ),
    false,
  )
})
