import assert from 'node:assert/strict'
import test from 'node:test'
import { docsExportGroupSuccessMessage } from '../src/views/docs/docsHubMessages.js'
import { setLocale } from '../src/i18n/index.js'

test('docsHubMessages follow locale', () => {
  setLocale('zh-CN')
  assert.match(docsExportGroupSuccessMessage(), /成功/)
  setLocale('en-US')
  assert.match(docsExportGroupSuccessMessage(), /exported/i)
  setLocale('zh-CN')
})
