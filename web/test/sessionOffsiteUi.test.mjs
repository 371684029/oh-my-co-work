import assert from 'node:assert/strict'
import test from 'node:test'
import {
  computeOffsiteActive,
  findActiveOffsiteNode,
  computeOffsiteMode,
  isCurrentOffsiteSegment,
  offsiteEntryLabel,
  offsiteInvokedMembers,
  offsiteInvokedLabel,
} from '../src/views/workbench/composables/sessionOffsiteUi.js'

test('computeOffsiteActive respects archived session and assist flags', () => {
  assert.equal(computeOffsiteActive({ status: 'archived' }, []), false)
  assert.equal(
    computeOffsiteActive(
      { status: 'running', context: { offsiteAssist: { archived: true, active: false } } },
      [],
    ),
    false,
  )
  assert.equal(
    computeOffsiteActive({ status: 'running', context: { offsiteAssist: { active: true } } }, []),
    true,
  )
  assert.equal(
    computeOffsiteActive({ status: 'running' }, [
      { step_type: 'offsite', status: 'running', output: {} },
    ]),
    true,
  )
})

test('findActiveOffsiteNode prefers pinned node', () => {
  const nodes = [
    { id: 'a', step_type: 'offsite', status: 'running', output: {} },
    { id: 'b', step_type: 'offsite', status: 'waiting_human', output: {} },
  ]
  assert.equal(findActiveOffsiteNode(nodes, null)?.id, 'a')
  assert.equal(
    findActiveOffsiteNode(nodes, { offsiteAssist: { active: true, nodeInstanceId: 'b' } })?.id,
    'b',
  )
})

test('offsite labels and invoked members', () => {
  const n = {
    id: 'x',
    step_type: 'offsite',
    status: 'running',
    output: {
      lastInvoked: [{ memberName: 'Alpha' }, { memberName: 'Beta' }],
      assists: [{ invoked: [{ memberName: 'Beta' }, { memberName: 'Gamma' }] }],
    },
  }
  assert.deepEqual(offsiteInvokedMembers(n), ['Beta', 'Gamma', 'Alpha'])
  assert.equal(offsiteInvokedLabel(n), '@Beta、@Gamma、@Alpha')
  assert.equal(
    offsiteEntryLabel(n, { activeOffsiteNodeId: 'x', mode: 'interrupt' }),
    '插队',
  )
  assert.equal(isCurrentOffsiteSegment(n, 'x'), true)
  assert.equal(isCurrentOffsiteSegment(n, 'y'), false)
  assert.equal(computeOffsiteMode({}, n, true), 'interrupt')
})
