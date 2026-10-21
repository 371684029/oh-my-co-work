import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearInbox,
  recordNotificationInbox,
  markInboxHandled,
  getInboxEntry,
} from '../src/composables/notificationInbox.js'

test('markInboxHandled stops remind via handledAt (NTF-14)', () => {
  clearInbox()
  recordNotificationInbox({ id: 'gate-1', title: 'Gate', body: 'Confirm' })
  markInboxHandled('gate-1', 'click')
  const hit = getInboxEntry('gate-1')
  assert.equal(hit?.read, true)
  assert.equal(hit?.handleAction, 'click')
  assert.ok(hit?.handledAt)
})
