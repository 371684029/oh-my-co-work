import assert from 'node:assert/strict'
import test from 'node:test'
import {
  flowRailTimelineCatLabel,
  flowRailTimelineFilterOptions,
} from '../src/views/workbench/composables/flowRailTimelineUi.js'

test('flowRailTimelineCatLabel maps known categories', () => {
  assert.match(flowRailTimelineCatLabel('node'), /步骤|Step/)
  assert.match(flowRailTimelineCatLabel('gate'), /闸门|Gate/)
  assert.equal(flowRailTimelineCatLabel('unknown'), 'unknown')
})

test('flowRailTimelineFilterOptions has six filters', () => {
  const opts = flowRailTimelineFilterOptions()
  assert.equal(opts.length, 6)
  assert.deepEqual(
    opts.map((o) => o.value),
    ['all', 'node', 'gate', 'terminal', 'docs', 'offsite'],
  )
})
