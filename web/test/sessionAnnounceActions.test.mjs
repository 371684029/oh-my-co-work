import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionAnnounceActions } from '../src/views/workbench/composables/sessionAnnounceActions.js'

test('createSessionAnnounceActions exposes handlers', () => {
  const actions = createSessionAnnounceActions({
    activeId: { value: '' },
    detail: { value: null },
    announceOpenLoading: { value: false },
    announceLoading: { value: false },
    loadDetail: async () => {},
    api: { sessions: {} },
  })
  assert.equal(typeof actions.openAnnouncementMd, 'function')
  assert.equal(typeof actions.rebuildAnnouncement, 'function')
})
