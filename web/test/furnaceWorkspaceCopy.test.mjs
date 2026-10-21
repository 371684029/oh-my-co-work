import assert from 'node:assert/strict'
import test from 'node:test'
import {
  furnacePagefillLabel,
  furnaceTurnCopySuccessMessage,
} from '../src/composables/furnaceWorkspaceCopy.js'
import { setLocale } from '../src/i18n/index.js'

test('furnaceWorkspaceCopy locale', () => {
  setLocale('en-US')
  assert.equal(furnacePagefillLabel(false), 'Page fill')
  assert.match(furnaceTurnCopySuccessMessage(), /Copied/i)
  setLocale('zh-CN')
  assert.match(furnaceTurnCopySuccessMessage(), /纯文本/)
})
