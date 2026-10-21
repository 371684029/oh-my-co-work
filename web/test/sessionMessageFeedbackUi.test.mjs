import assert from 'node:assert/strict'
import test from 'node:test'
import { mentionPendingSuccessMessage } from '../src/views/workbench/composables/sessionMessageFeedbackUi.js'
import { setLocale } from '../src/i18n/index.js'

test('mentionPendingSuccessMessage', () => {
  setLocale('zh-CN')
  assert.match(mentionPendingSuccessMessage('planned'), /挂起/)
  setLocale('en-US')
  assert.match(mentionPendingSuccessMessage('other'), /Offsite/i)
  setLocale('zh-CN')
})
