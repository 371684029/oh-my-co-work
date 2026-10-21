/**
 * Desktop stack smoke (5.3.0 ENG-01 / 5.1.0 TEST-01 partial).
 * Validates critical modules load; full GUI launch remains manual / NTF-T3.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

test('smoke: notifier + urls + notification platform exports', async () => {
  const { createNotifier, parseSessionDeepLink } = await import('../lib/notifier.mjs')
  assert.equal(typeof createNotifier, 'function')
  assert.equal(parseSessionDeepLink('session:abc'), 'abc')
  const { normalizeAppOrigin, workbenchUrl } = await import('../lib/urls.mjs')
  assert.match(normalizeAppOrigin('http://127.0.0.1:3780'), /^https?:\/\//)
  assert.match(workbenchUrl('http://127.0.0.1:3780', 's1'), /workbench\/s1/)
})

test('smoke: session timeline builder importable from server package path', async () => {
  const { buildSessionTimeline } = await import('../../server/src/sessionTimeline.js')
  assert.equal(buildSessionTimeline({ nodes: [], messages: [], terminals: [] }).length, 0)
})
