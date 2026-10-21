import test from 'node:test'
import assert from 'node:assert/strict'
import { createCoalescedAsync } from '../src/composables/coalescedReload.js'

test('createCoalescedAsync batches calls within delay', async () => {
  let n = 0
  const run = createCoalescedAsync(async (x) => {
    n += x
  }, 20)
  run(1)
  run(2)
  run(3)
  await new Promise((r) => setTimeout(r, 40))
  assert.equal(n, 3)
})
