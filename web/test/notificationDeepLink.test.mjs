import assert from 'node:assert/strict'
import test from 'node:test'

const { parseNotificationDeepLink } = await import('../src/composables/notificationDeepLink.js')

test('parseNotificationDeepLink docs and session', () => {
  assert.deepEqual(parseNotificationDeepLink('docs:abc:README.md'), {
    type: 'docs',
    sessionId: 'abc',
    file: 'README.md',
  })
  assert.deepEqual(parseNotificationDeepLink('session:xyz'), {
    type: 'session',
    sessionId: 'xyz',
  })
})
