import assert from 'node:assert/strict'
import test from 'node:test'

const storage = new Map()
globalThis.localStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
}

const {
  readDocsReadingHistory,
  recordDocsOpen,
  toggleDocsPin,
  isDocsPinned,
  recentDocsPreview,
  DOCS_HISTORY_KEY,
} = await import('../src/views/docs/docsReadingHistory.js')

test('recordDocsOpen dedupes and orders recent', () => {
  storage.clear()
  recordDocsOpen({ sessionId: 'a', name: 'ANNOUNCEMENT.md', label: '报告' })
  recordDocsOpen({ sessionId: 'b', name: 'README.md' })
  recordDocsOpen({ sessionId: 'a', name: 'ANNOUNCEMENT.md' })
  const h = readDocsReadingHistory()
  assert.equal(h.recent.length, 2)
  assert.equal(h.recent[0].sessionId, 'a')
  assert.ok(storage.has(DOCS_HISTORY_KEY))
})

test('toggleDocsPin and preview', () => {
  storage.clear()
  recordDocsOpen({ sessionId: 's1', name: 'f1.md' })
  recordDocsOpen({ sessionId: 's2', name: 'f2.md' })
  recordDocsOpen({ sessionId: 's3', name: 'f3.md' })
  toggleDocsPin({ sessionId: 's2', name: 'f2.md', label: '台账' })
  const h = readDocsReadingHistory()
  assert.equal(h.pinned.length, 1)
  assert.equal(isDocsPinned('s2', 'f2.md', h.pinned), true)
  assert.deepEqual(recentDocsPreview(h.recent, 2).map((x) => x.sessionId), ['s3', 's2'])
})
