import assert from 'node:assert/strict'
import test from 'node:test'
import {
  flowRailFormatTimelineAt,
  flowRailTimelineCatLabel,
  flowRailTimelineFilterOptions,
} from '../src/views/workbench/composables/flowRailTimelineUi.js'

test('flowRailTimelineCatLabel maps known categories', () => {
  assert.match(flowRailTimelineCatLabel('node'), /步骤|Step/)
  assert.match(flowRailTimelineCatLabel('gate'), /闸门|Gate/)
  assert.equal(flowRailTimelineCatLabel('unknown'), 'unknown')
})

test('flowRailTimelineFilterOptions has seven filters', () => {
  const opts = flowRailTimelineFilterOptions()
  assert.equal(opts.length, 7)
  assert.deepEqual(
    opts.map((o) => o.value),
    ['all', 'node', 'gate', 'terminal', 'docs', 'offsite', 'verify'],
  )
})

test('flowRailFormatTimelineAt formats iso timestamps and guards empty', () => {
  assert.equal(flowRailFormatTimelineAt(''), '—')
  assert.equal(flowRailFormatTimelineAt(null), '—')
  assert.match(flowRailFormatTimelineAt('2026-10-23T08:30:00.000Z'), /\d/)
  assert.equal(typeof flowRailFormatTimelineAt('not-a-date'), 'string')
})
