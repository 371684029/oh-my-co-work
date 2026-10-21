import assert from 'node:assert/strict'
import test from 'node:test'
import {
  docsHubColTitle,
  docsHubExportAllLabel,
  docsHubWelcomeRegionAria,
} from '../src/views/docs/docsHubCopy.js'
import { setLocale } from '../src/i18n/index.js'

test('docsHubCopy respects locale', () => {
  setLocale('zh-CN')
  assert.equal(docsHubColTitle('group'), '群模板')
  assert.match(docsHubWelcomeRegionAria(), /欢迎/)
  setLocale('en-US')
  assert.equal(docsHubExportAllLabel(), 'Export all')
  setLocale('zh-CN')
})
