import test from 'node:test'
import assert from 'node:assert/strict'
import {
  shouldDedupeNotification,
  parseSessionDeepLink,
} from '../lib/notifier.mjs'

test('shouldDedupeNotification collapses repeats within window', () => {
  let t = 1_000_000
  assert.equal(shouldDedupeNotification('gate:1', t, 5000), false)
  assert.equal(shouldDedupeNotification('gate:1', t + 1000, 5000), true)
  assert.equal(shouldDedupeNotification('gate:1', t + 6000, 5000), false)
})

test('parseSessionDeepLink accepts session: and acw:// forms', () => {
  assert.equal(parseSessionDeepLink('session:abc-123'), 'abc-123')
  assert.equal(parseSessionDeepLink('acw://session/xyz'), 'xyz')
  assert.equal(parseSessionDeepLink(''), null)
})
