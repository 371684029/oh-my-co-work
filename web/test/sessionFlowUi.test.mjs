import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildFlowEntries,
  computeFlowHistorySplitIndex,
  flowNodeClass,
  isCurrentStepNode,
  isWaitingHumanStep,
  pickFlowAnchorNodeId,
} from '../src/views/workbench/composables/sessionFlowUi.js'

test('isCurrentStepNode respects archived session', () => {
  const n = { step_type: 'member', step_index: 1, status: 'running' }
  assert.equal(isCurrentStepNode(n, { current_step_index: 1, status: 'archived' }), false)
  assert.equal(isCurrentStepNode(n, { current_step_index: 1, status: 'active' }), true)
})

test('buildFlowEntries groups adjacent discarded nodes', () => {
  const session = { current_step_index: 2, status: 'active' }
  const nodes = [
    { id: 'a', step_type: 'member', step_index: 0, status: 'skipped' },
    { id: 'b', step_type: 'member', step_index: 1, status: 'skipped' },
    { id: 'c', step_type: 'member', step_index: 2, status: 'running' },
  ]
  const entries = buildFlowEntries(nodes, session)
  assert.equal(entries.length, 2)
  assert.equal(entries[0].type, 'skipped')
  assert.equal(entries[0].nodes.length, 2)
  assert.equal(entries[1].type, 'node')
})

test('pickFlowAnchorNodeId prefers waiting human at current step', () => {
  const session = { current_step_index: 1, status: 'active' }
  const nodes = [
    { id: 'n1', step_type: 'member', step_index: 0, status: 'succeeded' },
    { id: 'n2', step_type: 'member', step_index: 1, status: 'waiting_human' },
    { id: 'n3', step_type: 'member', step_index: 2, status: 'pending' },
  ]
  assert.equal(pickFlowAnchorNodeId(nodes, session), 'n2')
})

test('flowNodeClass highlights running and current steps', () => {
  const session = { current_step_index: 1, status: 'active' }
  assert.equal(
    flowNodeClass({ step_type: 'member', step_index: 1, status: 'running' }, session),
    'running',
  )
  assert.equal(
    flowNodeClass({ step_type: 'member', step_index: 1, status: 'pending' }, session),
    'current',
  )
  assert.equal(isWaitingHumanStep({ step_type: 'human', step_index: 1, status: 'pending' }, session), true)
})

test('computeFlowHistorySplitIndex uses clone batch when present', () => {
  const nodes = [
    { id: '1', step_index: 0 },
    { id: '2', step_index: 1, output: { cloneBatchId: 'b1' } },
    { id: '3', step_index: 2 },
  ]
  assert.equal(computeFlowHistorySplitIndex(nodes, { context: { lastRestart: { cloneBatchId: 'b1' } } }), 1)
})
