import assert from 'node:assert/strict'
import test from 'node:test'
import { furnacePagefillLabel } from '../src/composables/furnaceWorkspaceCopy.js'
import { setLocale } from '../src/i18n/index.js'

test('furnaceWorkspaceCopy locale', () => {
  setLocale('en-US')
  assert.equal(furnacePagefillLabel(false), 'Page fill')
  setLocale('zh-CN')
})
