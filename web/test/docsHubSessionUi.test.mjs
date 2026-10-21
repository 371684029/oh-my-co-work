import assert from 'node:assert/strict'
import test from 'node:test'
import {
  docsExpandSessionInTree,
  isDocsSessionExpanded,
  toggleDocsSessionExpansion,
} from '../src/views/docs/docsHubSessionUi.js'

test('docs session expand toggles', () => {
  assert.equal(isDocsSessionExpanded({}, 's1'), true)
  assert.equal(isDocsSessionExpanded({ s1: false }, 's1'), false)
  const next = toggleDocsSessionExpansion({ s1: false }, 's1')
  assert.equal(next.s1, true)
})

test('toggleDocsSessionExpansion flips default expanded', () => {
  const next = toggleDocsSessionExpansion({}, 's1')
  assert.equal(isDocsSessionExpanded(next, 's1'), false)
  const again = toggleDocsSessionExpansion(next, 's1')
  assert.equal(isDocsSessionExpanded(again, 's1'), true)
})

test('docsExpandSessionInTree selects group', () => {
  const groups = [{ groupId: 'g1', sessions: [{ sessionId: 's9' }] }]
  const patch = docsExpandSessionInTree(groups, 's9', {})
  assert.equal(patch.selectedGroupId, 'g1')
  assert.equal(patch.expandedSessions.s9, true)
})
