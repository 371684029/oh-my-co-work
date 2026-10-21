import test from 'node:test'
import assert from 'node:assert/strict'
import {
  archiveOutcomeOf,
  relativeSessionTime,
  sessionListParts,
} from '../src/views/workbench/composables/sessionListUi.js'

test('sessionListParts uses manual title when titleAuto is false', () => {
  const parts = sessionListParts({
    title: '自定义标题',
    context: { titleAuto: false },
  })
  assert.equal(parts.label, '自定义标题')
  assert.equal(parts.groupAbbr, '')
})

test('relativeSessionTime formats hours', () => {
  const now = Date.parse('2026-01-01T12:00:00Z')
  const iso = '2026-01-01T10:00:00Z'
  assert.equal(relativeSessionTime(iso, now), '2h')
})

test('archiveOutcomeOf detects failed nodes', () => {
  assert.equal(
    archiveOutcomeOf({ status: 'archived' }, [{ status: 'failed' }]),
    'failed',
  )
  assert.equal(archiveOutcomeOf({ status: 'archived', archive_reason: 'manual' }, []), 'success')
})
