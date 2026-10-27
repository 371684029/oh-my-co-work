import test from 'node:test'
import assert from 'node:assert/strict'
import {
  shouldCopySelection,
  createSelectToCopyDebouncer,
} from '../src/composables/terminalSelectToCopy.js'

function fakeTimers() {
  let now = 0
  let seq = 0
  const jobs = new Map()
  return {
    setTimeoutFn(fn, ms) {
      const id = ++seq
      jobs.set(id, { at: now + ms, fn })
      return id
    },
    clearTimeoutFn(id) {
      jobs.delete(id)
    },
    advance(ms) {
      now += ms
      const due = [...jobs.entries()]
        .filter(([, j]) => j.at <= now)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])
      for (const [id, job] of due) {
        jobs.delete(id)
        job.fn()
      }
    },
    pending() {
      return jobs.size
    },
  }
}

test('shouldCopySelection: flag off → no copy', () => {
  assert.equal(shouldCopySelection({ selectToCopy: false, hasSelection: true }), false)
  assert.equal(shouldCopySelection({ selectToCopy: undefined, hasSelection: true }), false)
})

test('shouldCopySelection: flag on + selection → copy', () => {
  assert.equal(shouldCopySelection({ selectToCopy: true, hasSelection: true }), true)
})

test('shouldCopySelection: flag on + no selection → no copy', () => {
  assert.equal(shouldCopySelection({ selectToCopy: true, hasSelection: false }), false)
})

test('createSelectToCopyDebouncer: flag off path never invokes onCopy when gated by shouldCopySelection', () => {
  const t = fakeTimers()
  let copies = 0
  const d = createSelectToCopyDebouncer({
    delayMs: 250,
    onCopy: () => {
      copies++
    },
    setTimeoutFn: t.setTimeoutFn,
    clearTimeoutFn: t.clearTimeoutFn,
  })
  // 模拟 onSelectionChange 后按 shouldCopySelection 决定是否 schedule
  if (shouldCopySelection({ selectToCopy: false, hasSelection: true })) d.schedule()
  t.advance(1000)
  assert.equal(copies, 0)
  assert.equal(t.pending(), 0)
})

test('createSelectToCopyDebouncer: flag on + selection copies after delay', () => {
  const t = fakeTimers()
  let copies = 0
  const d = createSelectToCopyDebouncer({
    delayMs: 250,
    onCopy: () => {
      copies++
    },
    setTimeoutFn: t.setTimeoutFn,
    clearTimeoutFn: t.clearTimeoutFn,
  })
  if (shouldCopySelection({ selectToCopy: true, hasSelection: true })) d.schedule()
  t.advance(249)
  assert.equal(copies, 0)
  t.advance(1)
  assert.equal(copies, 1)
})

test('createSelectToCopyDebouncer: flag on + no selection never schedules', () => {
  const t = fakeTimers()
  let copies = 0
  const d = createSelectToCopyDebouncer({
    delayMs: 250,
    onCopy: () => {
      copies++
    },
    setTimeoutFn: t.setTimeoutFn,
    clearTimeoutFn: t.clearTimeoutFn,
  })
  if (shouldCopySelection({ selectToCopy: true, hasSelection: false })) d.schedule()
  t.advance(1000)
  assert.equal(copies, 0)
  assert.equal(t.pending(), 0)
})

test('createSelectToCopyDebouncer: rapid selection changes only fire once', () => {
  const t = fakeTimers()
  let copies = 0
  const d = createSelectToCopyDebouncer({
    delayMs: 250,
    onCopy: () => {
      copies++
    },
    setTimeoutFn: t.setTimeoutFn,
    clearTimeoutFn: t.clearTimeoutFn,
  })
  for (let i = 0; i < 5; i++) {
    if (shouldCopySelection({ selectToCopy: true, hasSelection: true })) d.schedule()
    t.advance(50)
  }
  assert.equal(copies, 0)
  t.advance(250)
  assert.equal(copies, 1)
  assert.equal(t.pending(), 0)
})

test('createSelectToCopyDebouncer: cancel clears pending copy', () => {
  const t = fakeTimers()
  let copies = 0
  const d = createSelectToCopyDebouncer({
    delayMs: 250,
    onCopy: () => {
      copies++
    },
    setTimeoutFn: t.setTimeoutFn,
    clearTimeoutFn: t.clearTimeoutFn,
  })
  d.schedule()
  d.cancel()
  t.advance(1000)
  assert.equal(copies, 0)
  assert.equal(t.pending(), 0)
})
