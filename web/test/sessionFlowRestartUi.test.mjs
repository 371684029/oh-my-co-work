import assert from 'node:assert/strict'
import test from 'node:test'
import { restartFromNodeSuccessMessage } from '../src/views/workbench/composables/sessionFlowRestartUi.js'
import { setLocale } from '../src/i18n/index.js'

test('restartFromNodeSuccessMessage', () => {
  setLocale('zh-CN')
  const msg = restartFromNodeSuccessMessage({
    title: 'Step A',
    forwardJump: true,
    wasArchived: false,
    wasOffsite: false,
    offsiteArchived: false,
  })
  assert.match(msg, /Step A/)
  setLocale('zh-CN')
})
