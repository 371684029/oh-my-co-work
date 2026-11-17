import assert from 'node:assert/strict'
import test from 'node:test'
import {
  docsHubColTitle,
  docsHubEditLabel,
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

test('docsHubEditLabel distinguishes DOC-IO kinds', () => {
  setLocale('zh-CN')
  assert.equal(docsHubEditLabel('announce'), '编辑群报告')
  assert.equal(docsHubEditLabel('step'), '编辑步骤台账')
  assert.equal(docsHubEditLabel('index'), '编辑文档索引')
  assert.equal(docsHubEditLabel('furnace'), '编辑')
})
