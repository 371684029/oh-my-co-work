import assert from 'node:assert/strict'
import test from 'node:test'
import { isArchiveStatusMessage } from '../src/views/workbench/composables/sessionBubbleUi.js'

test('isArchiveStatusMessage detects archive system lines', () => {
  assert.equal(isArchiveStatusMessage({ role: 'system' }, '任务已自动归档'), true)
  assert.equal(isArchiveStatusMessage({ type: 'status' }, '开始归档'), true)
  assert.equal(isArchiveStatusMessage({ role: 'user' }, 'hello'), false)
})
