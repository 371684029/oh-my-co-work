import assert from 'node:assert/strict'
import test from 'node:test'
import { sessionPinSuccessMessage } from '../src/views/workbench/composables/sessionPinFeedbackUi.js'
import { setLocale } from '../src/i18n/index.js'

test('sessionPinSuccessMessage', () => {
  setLocale('en-US')
  assert.match(sessionPinSuccessMessage(true), /Pinned/i)
  setLocale('zh-CN')
})
