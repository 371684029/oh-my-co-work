import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeTrayStatus,
  trayStateLabel,
  isNotificationsPaused,
  pauseForOneHour,
  pauseUntilTomorrow,
  formatTrayTooltip,
  formatTrayMenuHeader,
} from '../lib/trayState.mjs'

test('normalizeTrayStatus maps renderer aliases onto 4 states', () => {
  assert.equal(normalizeTrayStatus('action'), 'needs-you')
  assert.equal(normalizeTrayStatus('needs-you'), 'needs-you')
  assert.equal(normalizeTrayStatus('running'), 'running')
  assert.equal(normalizeTrayStatus('active'), 'running')
  assert.equal(normalizeTrayStatus('error'), 'error')
  assert.equal(normalizeTrayStatus('failed'), 'error')
  assert.equal(normalizeTrayStatus('idle'), 'idle')
  assert.equal(normalizeTrayStatus(''), 'idle')
  assert.equal(normalizeTrayStatus('whatever'), 'idle')
  assert.equal(trayStateLabel('needs-you'), '需要你')
})

test('pause windows and tooltip text (NTF-07)', () => {
  const now = Date.parse('2026-10-23T10:00:00')
  assert.equal(isNotificationsPaused(0, now), false)
  const hour = pauseForOneHour(now)
  assert.equal(isNotificationsPaused(hour, now), true)
  assert.equal(isNotificationsPaused(hour, hour + 1), false)
  const tomorrow = pauseUntilTomorrow(now)
  const d = new Date(tomorrow)
  assert.equal(d.getHours(), 9)
  assert.ok(tomorrow > now + 12 * 3600 * 1000)

  const tip = formatTrayTooltip({ state: 'needs-you', pending: 3, pausedUntil: hour, now })
  assert.match(tip, /需要你/)
  assert.match(tip, /3 项待处理/)
  assert.match(tip, /通知已暂停至 /)

  const header = formatTrayMenuHeader({ state: 'error', pending: 1, pausedUntil: 0, now })
  assert.match(header, /出错了/)
  assert.match(header, /1 项待处理/)
  assert.equal(/通知已暂停/.test(header), false)
})
