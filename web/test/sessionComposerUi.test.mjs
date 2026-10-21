import test from 'node:test'
import assert from 'node:assert/strict'
import {
  composerFooterHintForGate,
  composerPlaceholderForGate,
  composerToolbarHintForGate,
} from '../src/views/workbench/composables/sessionComposerUi.js'
import { setLocale } from '../src/i18n/index.js'

test('composerPlaceholderForGate session_start', () => {
  setLocale('zh-CN')
  const p = composerPlaceholderForGate({ content: { mode: 'session_start', captureParams: true } })
  assert.match(p, /通过/)
})

test('composerToolbarHintForGate idle', () => {
  assert.match(composerToolbarHintForGate(null), /Enter 发送/)
})

test('composerFooterHintForGate with gate', () => {
  assert.match(composerFooterHintForGate({ content: {} }), /群报告/)
})
