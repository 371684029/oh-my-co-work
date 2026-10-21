import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseStartTarget,
  startChatSuccessMessage,
} from '../src/views/workbench/composables/sessionStartChatUi.js'
import { setLocale } from '../src/i18n/index.js'

test('parseStartTarget', () => {
  assert.deepEqual(parseStartTarget('g:abc'), { kind: 'g:', id: 'abc' })
  assert.equal(parseStartTarget('bad'), null)
})

test('startChatSuccessMessage locale', () => {
  setLocale('zh-CN')
  assert.match(startChatSuccessMessage('g:', false), /开聊/)
  setLocale('en-US')
  assert.match(startChatSuccessMessage('m:', true), /Returned/i)
  setLocale('zh-CN')
})
