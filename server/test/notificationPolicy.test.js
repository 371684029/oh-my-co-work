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
