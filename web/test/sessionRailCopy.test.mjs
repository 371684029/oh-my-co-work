import assert from 'node:assert/strict'
import test from 'node:test'
import {
  sessionRailEmptyTitle,
  sessionRailStartSelectAria,
  sessionRailTitle,
} from '../src/views/workbench/composables/sessionRailCopy.js'

test('sessionRailCopy returns non-empty labels', () => {
  assert.match(sessionRailTitle(), /会话|Sessions/)
  assert.match(sessionRailStartSelectAria(), /群模板|group|member/i)
  assert.match(sessionRailEmptyTitle(), /还没有|No sessions/i)
})
