import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isWithinQuietHours,
  shouldSuppressForegroundNotification,
  shouldThrottleNotification,
  mergeGateNotificationBodies,
  shouldStopReminding,
  canDeliverDesktopNotification,
  notificationShouldBeSilent,
  doneNotificationIntentForEvent,
} from '@acw/shared'

test('isWithinQuietHours handles wrap-around', () => {
  const night = new Date('2026-01-15T23:30:00').getTime()
  const morning = new Date('2026-01-15T06:00:00').getTime()
  const noon = new Date('2026-01-15T12:00:00').getTime()
  const q = { enabled: true, start: '22:00', end: '07:00' }
  assert.equal(isWithinQuietHours(night, q), true)
  assert.equal(isWithinQuietHours(morning, q), true)
  assert.equal(isWithinQuietHours(noon, q), false)
})

test('shouldSuppressForegroundNotification when viewing same session', () => {
  assert.equal(
    shouldSuppressForegroundNotification({
      onlyWhenUnfocused: true,
      documentHidden: false,
      documentHasFocus: true,
      viewingSameSession: true,
      level: 'action',
    }),
    true,
  )
  assert.equal(
    shouldSuppressForegroundNotification({
      onlyWhenUnfocused: true,
      documentHidden: true,
      documentHasFocus: false,
      viewingSameSession: true,
      level: 'action',
    }),
    false,
  )
})

test('mergeGateNotificationBodies dedupes', () => {
  const body = mergeGateNotificationBodies(['步骤 A'], '步骤 B')
  assert.match(body, /步骤 A/)
  assert.match(body, /步骤 B/)
})

test('shouldStopReminding respects read and cap', () => {
  assert.equal(shouldStopReminding({ readAt: 1 }), true)
  assert.equal(shouldStopReminding({ sentCount: 3, maxReminders: 3 }), true)
  assert.equal(shouldStopReminding({ sentCount: 1, maxReminders: 3 }), false)
})

test('canDeliverDesktopNotification combines policy', () => {
  const base = {
    enabled: true,
    levelAllowed: true,
    now: Date.now(),
    quiet: { enabled: false },
    foreground: {
      onlyWhenUnfocused: true,
      documentHidden: false,
      documentHasFocus: true,
      viewingSameSession: false,
      level: 'action',
    },
    throttleMs: 30_000,
    lastSentAt: 0,
    remind: { sentCount: 0, maxReminders: 3 },
    dedupe: false,
  }
  assert.equal(canDeliverDesktopNotification(base).ok, true)
  assert.equal(
    canDeliverDesktopNotification({ ...base, dedupe: true }).reason,
    'dedupe',
  )
})

test('notificationShouldBeSilent respects level and user sound pref', () => {
  assert.equal(notificationShouldBeSilent({ level: 'action', sound: true }), false)
  assert.equal(notificationShouldBeSilent({ level: 'error', sound: true }), false)
  assert.equal(notificationShouldBeSilent({ level: 'done', sound: true }), true)
  assert.equal(notificationShouldBeSilent({ level: 'action', sound: false }), true)
})

test('doneNotificationIntentForEvent maps terminal session states with stable ids (NTF-02)', () => {
  const archived = doneNotificationIntentForEvent(
    { type: 'session.status', payload: { sessionId: 's1', status: 'archived' } },
    { sessionTitle: '演示流' },
  )
  assert.equal(archived.level, 'done')
  assert.equal(archived.id, 'done:session:s1:archived')
  assert.equal(archived.deepLink, 'session:s1')
  assert.match(archived.title, /演示流/)

  const done = doneNotificationIntentForEvent(
    { type: 'session.status', payload: { sessionId: 's1', status: 'done' } },
    { sessionTitle: '演示流' },
  )
  assert.equal(done.level, 'done')
  assert.equal(done.id, 'done:session:s1:done')

  const archivedType = doneNotificationIntentForEvent(
    { type: 'session.archived', payload: { sessionId: 's1' } },
    { sessionTitle: '演示流' },
  )
  assert.equal(archivedType.id, 'done:session:s1:archived')

  // stable: same event → same id (dedupe key)
  assert.equal(archived.id, archivedType.id)
})

test('doneNotificationIntentForEvent maps announcement.updated and skips non-terminal', () => {
  const announcement = doneNotificationIntentForEvent(
    { type: 'announcement.updated', payload: { sessionId: 's2', path: 'a.md' } },
    { sessionTitle: '周报' },
  )
  assert.equal(announcement.level, 'done')
  assert.equal(announcement.id, 'docs-updated:s2')
  assert.equal(announcement.deepLink, 'docs:s2:ANNOUNCEMENT.md')

  assert.equal(
    doneNotificationIntentForEvent({ type: 'session.status', payload: { sessionId: 's2', status: 'active' } }),
    null,
  )
  assert.equal(
    doneNotificationIntentForEvent({ type: 'session.status', payload: { sessionId: 's2', status: 'waiting_human', unarchived: true } }),
    null,
  )
  assert.equal(
    doneNotificationIntentForEvent({ type: 'gate.request', payload: { sessionId: 's2' } }),
    null,
  )
  assert.equal(doneNotificationIntentForEvent({ type: 'announcement.updated', payload: {} }), null)
})
