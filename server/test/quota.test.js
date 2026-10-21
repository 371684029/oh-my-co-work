import test from 'node:test'
import assert from 'node:assert/strict'
import { quotaLimits, redactOpts } from '../src/terminal/quota.js'

test('quotaLimits applies defaults', () => {
  const q = quotaLimits({ quota: {} })
  assert.equal(q.maxConcurrent, 8)
  assert.equal(q.maxLogBytes, 10 * 1024 * 1024)
  assert.equal(q.maxReplayChars, 256 * 1024)
})

test('quotaLimits reads custom MiB/KiB', () => {
  const q = quotaLimits({
    quota: { maxConcurrentTerminals: 3, maxLogMiB: 2, maxReplayKiB: 64 },
  })
  assert.equal(q.maxConcurrent, 3)
  assert.equal(q.maxLogBytes, 2 * 1024 * 1024)
  assert.equal(q.maxReplayChars, 64 * 1024)
})

test('redactOpts defaults enabled', () => {
  assert.deepEqual(redactOpts({}), { enabled: true, patternsText: '' })
})
