import assert from 'node:assert/strict'
import test from 'node:test'
import { gateActionToast } from '../src/views/workbench/composables/sessionGateFeedbackUi.js'
import { setLocale } from '../src/i18n/index.js'

test('gateActionToast maps approve/reject', () => {
  setLocale('zh-CN')
  assert.match(gateActionToast('approve', false).message, /同意/)
  assert.match(gateActionToast('reject', true).message, /附言/)
  setLocale('en-US')
  assert.match(gateActionToast('cancel_start').message, /Cancelled/i)
  setLocale('zh-CN')
})
