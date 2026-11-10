import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createTerminalWriteFlusher,
} from '../src/composables/terminalWriteScheduler.js'

test('write flusher coalesces chunks until flushPending', () => {
  const writes = []
  const flusher = createTerminalWriteFlusher({
    write: (t) => writes.push(t),
    isActive: () => true,
  })
  flusher.enqueue('a')
  flusher.enqueue('b')
  assert.equal(writes.length, 0)
  flusher.flushPending()
  assert.deepEqual(writes, ['ab'])
  flusher.dispose()
})

test('write flusher holds chunks while inactive', () => {
  const writes = []
  let active = false
  const flusher = createTerminalWriteFlusher({
    write: (t) => writes.push(t),
    isActive: () => active,
  })
  flusher.enqueue('hello')
  flusher.flushPending()
  assert.equal(writes.length, 0)
  active = true
  flusher.flushPending({ force: true })
  assert.deepEqual(writes, ['hello'])
  flusher.dispose()
})
