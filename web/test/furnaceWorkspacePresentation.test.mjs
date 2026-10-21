import assert from 'node:assert/strict'
import test from 'node:test'
import {
  furnaceBuddyMood,
  furnaceFailHint,
  furnaceFooterHint,
  FURNACE_QUICK_CHIPS,
} from '../src/composables/furnaceWorkspacePresentation.js'

test('FURNACE_QUICK_CHIPS is non-empty', () => {
  assert.ok(FURNACE_QUICK_CHIPS.length >= 3)
})

test('furnaceFailHint prefers lastError', () => {
  assert.match(furnaceFailHint({ lastError: 'boom' }, 'grok'), /boom/)
})

test('furnaceBuddyMood running vs waiting', () => {
  assert.equal(furnaceBuddyMood('running', 'open'), 'working')
  assert.equal(furnaceBuddyMood('exited', 'open'), 'waiting')
})

test('furnaceFooterHint when stopped', () => {
  assert.match(furnaceFooterHint({ isRunning: false }), /进程已结束/)
})
