import assert from 'node:assert/strict'
import test from 'node:test'
import {
  composerAtPanelTitle,
  composerSlashPanelTitle,
} from '../src/views/workbench/composables/sessionComposerPanelUi.js'
import { composerUploadSuccessMessage } from '../src/views/workbench/composables/sessionComposerUploadUi.js'
import { setLocale } from '../src/i18n/index.js'

test('sessionComposerPanelUi', () => {
  setLocale('zh-CN')
  assert.equal(composerSlashPanelTitle(), '斜杠指令')
  assert.match(composerAtPanelTitle(), /@/)
  assert.match(composerUploadSuccessMessage(2), /2/)
  setLocale('en-US')
  assert.match(composerSlashPanelTitle(), /Slash/)
})
