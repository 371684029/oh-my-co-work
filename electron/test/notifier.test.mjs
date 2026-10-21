import test from 'node:test'
import assert from 'node:assert/strict'
import {
  shouldDedupeNotification,
  parseSessionDeepLink,
  parseNotificationDeepLink,
  createNotifier,
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

test('parseNotificationDeepLink accepts docs deep links', () => {
  const d = parseNotificationDeepLink('docs:s1:ANNOUNCEMENT.md')
  assert.equal(d.type, 'docs')
  assert.equal(d.sessionId, 's1')
  assert.equal(d.file, 'ANNOUNCEMENT.md')
})

test('createNotifier click focuses window and routes deepLink (NTF-T2)', () => {
  const clicks = []
  class FakeNotification {
    constructor({ title, body }) {
      this.title = title
      this.body = body
    }
    on(evt, fn) {
      if (evt === 'click') this._click = fn
    }
    show() {
      clicks.push(this)
    }
  }
  FakeNotification.isSupported = () => true
  let focused = false
  let deepLink = ''
  const notifier = createNotifier({
    Notification: FakeNotification,
    getMainWindow: () => ({
      isDestroyed: () => false,
      show: () => {},
      focus: () => {
        focused = true
      },
    }),
    onDeepLink: (link) => {
      deepLink = link
    },
  })
  assert.equal(notifier.notify({ title: 'Gate', body: 'Confirm', deepLink: 'session:s1' }), true)
  assert.equal(clicks.length, 1)
  clicks[0]._click()
  assert.equal(focused, true)
  assert.equal(deepLink, 'session:s1')
})

test('createNotifier reports click/dismiss to onNotificationAction (NTF-14)', () => {
  const actions = []
  const instances = []
  class FakeNotification {
    constructor() {}
    on(evt, fn) {
      if (evt === 'click') this._click = fn
      if (evt === 'close') this._close = fn
    }
    show() {
      instances.push(this)
    }
  }
  FakeNotification.isSupported = () => true
  const notifier = createNotifier({
    Notification: FakeNotification,
    getMainWindow: () => null,
    onNotificationAction: (p) => actions.push(p),
  })
  notifier.notify({ id: 'n1', title: 'T', body: 'B', deepLink: 'session:x' })
  assert.equal(instances.length, 1)
  instances[0]._click()
  instances[0]._close()
  assert.deepEqual(actions, [
    { id: 'n1', deepLink: 'session:x', action: 'click' },
    { id: 'n1', action: 'dismiss' },
  ])
})

test('createNotifier silent follows level and sound (NTF-13)', () => {
  let lastSilent
  class FakeNotification {
    constructor(opts) {
      lastSilent = opts?.silent
    }
    on() {}
    show() {}
  }
  FakeNotification.isSupported = () => true
  const notifier = createNotifier({
    Notification: FakeNotification,
    getMainWindow: () => null,
  })
  notifier.notify({ title: 'A', level: 'action', sound: true })
  assert.equal(lastSilent, false)
  notifier.notify({ title: 'D', level: 'done', sound: true })
  assert.equal(lastSilent, true)
  notifier.notify({ title: 'E', level: 'error', sound: false })
  assert.equal(lastSilent, true)
})
