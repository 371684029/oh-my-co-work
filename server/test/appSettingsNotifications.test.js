import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultNotificationSettings } from '../src/appSettings.js'

test('defaultNotificationSettings enables action/error by default', () => {
  const d = defaultNotificationSettings()
  assert.equal(d.enabled, true)
  assert.equal(d.levels.action, true)
  assert.equal(d.levels.error, true)
  assert.equal(d.levels.done, false)
})

test('allowActionButtons stays retired (NTF-18 choice b)', () => {
  const d = defaultNotificationSettings()
  assert.equal('allowActionButtons' in d, false)
  assert.deepEqual(Object.keys(d).sort(), [
    'enabled',
    'levels',
    'maxReminders',
    'onlyWhenUnfocused',
    'quietHours',
    'remindIntervalMs',
    'sound',
  ])
})
