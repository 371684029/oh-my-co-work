import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveStepRunPolicy, runWithTimeout } from '../src/stepRunPolicy.js'

test('resolveStepRunPolicy reads step.run fields', () => {
  const p = resolveStepRunPolicy({
    run: { timeoutSec: 30, retry: { max: 2, intervalSec: 1 }, onFailure: 'skip' },
  })
  assert.equal(p.timeoutMs, 30_000)
  assert.equal(p.maxRetries, 2)
  assert.equal(p.onFailure, 'skip')
})

test('runWithTimeout rejects when exceeded', async () => {
  await assert.rejects(
    () =>
      runWithTimeout(
        new Promise((r) => setTimeout(() => r('late'), 80)),
        20,
      ),
    (e) => e.code === 'STEP_TIMEOUT',
  )
})
