import assert from 'node:assert/strict'
import test from 'node:test'
import {
  gateApproveButtonLabel,
  gatePassButtonLabel,
} from '../src/views/workbench/composables/sessionGatePanelUi.js'
import { furnaceStatusBarLine } from '../src/composables/furnaceWorkspaceCopy.js'
import { setLocale } from '../src/i18n/index.js'

test('sessionGatePanelUi', () => {
  setLocale('zh-CN')
  assert.equal(gatePassButtonLabel(), '通过')
  assert.equal(gateApproveButtonLabel(true), '同意并完成')
  assert.match(furnaceStatusBarLine(false, 'chat'), /GUI/)
  setLocale('en-US')
  assert.match(gatePassButtonLabel(), /Pass/i)
})
