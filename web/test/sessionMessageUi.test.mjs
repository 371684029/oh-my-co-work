import test from 'node:test'
import assert from 'node:assert/strict'
import { roleLabel, shortSender } from '../src/views/workbench/composables/sessionMessageUi.js'

test('roleLabel user', () => {
  assert.equal(roleLabel({ role: 'user' }), '我')
})

test('shortSender abbreviates long Chinese name', () => {
  assert.equal(shortSender({ role: 'member' }, '自动化测试助手'), '自动')
})
