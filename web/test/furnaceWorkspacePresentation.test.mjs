import assert from 'node:assert/strict'
import test from 'node:test'
import {
  furnaceBuddyMood,
  furnaceFailHint,
  furnaceFooterHint,
  furnaceQuickChips,
} from '../src/composables/furnaceWorkspacePresentation.js'
import { setLocale } from '../src/i18n/index.js'

test('furnaceQuickChips is non-empty', () => {
  setLocale('zh-CN')
  assert.ok(furnaceQuickChips().length >= 3)
})

test('furnaceFailHint prefers lastError', () => {
  assert.match(furnaceFailHint({ lastError: 'boom' }, 'grok'), /boom/)
})

test('furnaceBuddyMood running vs waiting', () => {
  assert.equal(furnaceBuddyMood('running', 'open'), 'working')
  assert.equal(furnaceBuddyMood('exited', 'open'), 'waiting')
})

test('furnaceFooterHint when stopped', () => {
  setLocale('zh-CN')
  assert.match(furnaceFooterHint({ isRunning: false }), /进程已结束/)
})
