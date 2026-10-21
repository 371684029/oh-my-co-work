import assert from 'node:assert/strict'
import test from 'node:test'
import {
  announceMdHintLabel,
  announceOpenedMessage,
  composerEmptyMessage,
  deleteConfirmDialogOptions,
  hashItemEmptyInsertMessage,
} from '../src/views/workbench/composables/sessionWorkbenchFeedbackUi.js'
import { setLocale } from '../src/i18n/index.js'

test('sessionWorkbenchFeedbackUi zh-CN', () => {
  setLocale('zh-CN')
  assert.equal(composerEmptyMessage(), '输入框为空')
  assert.match(announceMdHintLabel('journals/foo.md'), /journals\/foo\.md/)
  assert.equal(announceOpenedMessage(''), '已打开群报告 MD')
  assert.match(hashItemEmptyInsertMessage('参数 A'), /参数 A/)
  assert.equal(deleteConfirmDialogOptions().title, '删除')
})

test('sessionWorkbenchFeedbackUi en-US', () => {
  setLocale('en-US')
  assert.match(composerEmptyMessage(), /empty/i)
  assert.match(announceMdHintLabel(''), /Markdown/i)
  assert.match(announceOpenedMessage('/tmp/x'), /Opened/)
  setLocale('zh-CN')
})
