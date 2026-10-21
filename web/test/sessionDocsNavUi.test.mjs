import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDocsHubQuery,
  docsHubOpenUsesNewTab,
  formatDocsHubSearchParams,
  resolveAnnounceMdRelativePath,
} from '../src/views/workbench/composables/sessionDocsNavUi.js'

test('resolveAnnounceMdRelativePath prefers detail paths', () => {
  assert.equal(
    resolveAnnounceMdRelativePath(
      { announcement: { path: 'a/b.md' }, session: { context: {} } },
      'sid',
    ),
    'a/b.md',
  )
  assert.equal(
    resolveAnnounceMdRelativePath(
      { session: { context: { announcementPath: 'ctx/path.md' } } },
      'sid',
    ),
    'ctx/path.md',
  )
  assert.equal(resolveAnnounceMdRelativePath(null, 'sid-1'), 'journals/sessions/sid-1/ANNOUNCEMENT.md')
  assert.equal(resolveAnnounceMdRelativePath(null, ''), '')
})

test('buildDocsHubQuery and search params', () => {
  assert.deepEqual(buildDocsHubQuery('s1'), { session: 's1', file: 'ANNOUNCEMENT.md' })
  assert.deepEqual(buildDocsHubQuery('s1', 'notes.md'), { session: 's1', file: 'notes.md' })
  assert.equal(buildDocsHubQuery(''), null)
  assert.equal(formatDocsHubSearchParams({ session: 'x', file: 'ANNOUNCEMENT.md' }), 'session=x&file=ANNOUNCEMENT.md')
})

test('docsHubOpenUsesNewTab', () => {
  assert.equal(docsHubOpenUsesNewTab({ newTab: true, hasDesktopApi: true, hasDesktopEnv: true }), true)
  assert.equal(docsHubOpenUsesNewTab({ newTab: false, hasDesktopApi: false, hasDesktopEnv: false }), true)
  assert.equal(docsHubOpenUsesNewTab({ newTab: false, hasDesktopApi: true, hasDesktopEnv: false }), false)
})
