import assert from 'node:assert/strict'
import test from 'node:test'
import {
  docsTimeRangeBuckets,
  filterDocsItemsByTimeRange,
  filterDocsGroupsById,
  totalDocsSessionCount,
} from '../src/views/docs/docsHubFilterUi.js'
import { highlightSearchSnippet } from '../src/views/docs/docsHubSearchUi.js'

test('docsTimeRangeBuckets counts by mtime', () => {
  const now = 1_000_000_000_000
  const items = [
    { mtimeMs: now - 1000 },
    { mtimeMs: now - 2 * 86400000 },
    { mtimeMs: now - 40 * 86400000 },
  ]
  const buckets = docsTimeRangeBuckets(items, now)
  assert.equal(buckets.find((b) => b.key === 'all').count, 3)
  assert.equal(buckets.find((b) => b.key === 'today').count, 1)
  assert.equal(buckets.find((b) => b.key === 'older').count, 1)
})

test('filterDocsItemsByTimeRange keeps today only', () => {
  const now = 1_000_000_000_000
  const items = [{ mtimeMs: now }, { mtimeMs: now - 9 * 86400000 }]
  assert.equal(filterDocsItemsByTimeRange(items, 'today', now).length, 1)
})

test('filterDocsGroupsById and session count', () => {
  const groups = [
    { groupId: 'a', sessions: [{ id: 1 }] },
    { groupId: 'b', sessions: [] },
  ]
  assert.equal(filterDocsGroupsById(groups, 'a').length, 1)
  assert.equal(totalDocsSessionCount(groups), 1)
})

test('highlightSearchSnippet wraps query tokens', () => {
  const html = highlightSearchSnippet('hello world', 'world')
  assert.match(html, /<mark>world<\/mark>/)
})
