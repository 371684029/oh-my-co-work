import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearInbox,
  recordNotificationInbox,
  markInboxHandled,
  markAllInboxRead,
  getInboxEntry,
  notificationInboxRef,
  toInboxApiRow,
  fromInboxApiRow,
  inboxTrayItems,
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

test('toInboxApiRow / fromInboxApiRow round-trip (NTF-06)', () => {
  const local = {
    id: 'gate:s1:1',
    at: '2026-10-23T02:00:00.000Z',
    level: 'action',
    title: '等你确认',
    body: '流程需要你处理',
    sessionId: 's1',
    deepLink: 'session:s1',
    read: true,
    handledAt: null,
    handleAction: null,
  }
  const apiRow = toInboxApiRow(local)
  assert.equal(apiRow.id, 'gate:s1:1')
  assert.equal(apiRow.eventId, 'gate:s1:1')
  assert.equal(apiRow.sessionId, 's1')
  assert.equal(apiRow.read, true)
  assert.equal(apiRow.createdAt, Date.parse('2026-10-23T02:00:00.000Z'))
  const back = fromInboxApiRow(apiRow)
  assert.equal(back.id, local.id)
  assert.equal(back.at, local.at)
  assert.equal(back.level, 'action')
  assert.equal(back.deepLink, 'session:s1')
  assert.equal(back.read, true)
})

test('inboxTrayItems returns top unread items capped (NTF-07)', () => {
  const rows = [
    { id: 'a', title: 'A', level: 'action', deepLink: 'session:a', read: false },
    { id: 'b', title: 'B', level: 'error', deepLink: 'session:b', read: false },
    { id: 'c', title: 'C', level: 'done', deepLink: 'session:c', read: true },
    { id: 'd', title: 'D', level: 'action', deepLink: 'session:d', read: false },
    { id: 'e', title: 'E', level: 'action', deepLink: 'session:e', read: false },
    { id: 'f', title: 'F', level: 'action', deepLink: 'session:f', read: false },
    { id: 'g', title: 'G', level: 'action', deepLink: 'session:g', read: false },
  ]
  const items = inboxTrayItems(rows)
  assert.equal(items.length, 5)
  assert.deepEqual(items.map((it) => it.id), ['a', 'b', 'd', 'e', 'f'])
  assert.equal(items[0].deepLink, 'session:a')
})

test('markAllInboxRead clears unread (NTF-06)', () => {
  clearInbox()
  recordNotificationInbox({ id: 'r1', title: 'T1' })
  recordNotificationInbox({ id: 'r2', title: 'T2' })
  markAllInboxRead()
  assert.equal(notificationInboxRef().value.every((it) => it.read), true)
  clearInbox()
})
