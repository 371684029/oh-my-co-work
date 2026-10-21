import assert from 'node:assert/strict'
import test from 'node:test'
import { validateNotifyPayload, assertNotifyRateLimit } from '../src/externalNotify.js'

test('validateNotifyPayload accepts minimal notify', () => {
  const p = validateNotifyPayload({ title: 'Hello', body: 'World', source: 'skill' })
  assert.equal(p.title, 'Hello')
  assert.equal(p.level, 'action')
})

test('assertNotifyRateLimit enforces per-source cap', () => {
  const src = `test-${Date.now()}`
  let t = 1_000_000
  for (let i = 0; i < 30; i++) {
    assertNotifyRateLimit(src, t)
    t += 100
  }
  assert.throws(() => assertNotifyRateLimit(src, t), /频率/)
})
