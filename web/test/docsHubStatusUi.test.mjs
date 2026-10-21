import assert from 'node:assert/strict'
import test from 'node:test'
import {
  docsFileLabel,
  docsSessionStatusClass,
  docsSessionStatusLabel,
} from '../src/views/docs/docsHubStatusUi.js'
import { setLocale } from '../src/i18n/index.js'

test('docsSessionStatusLabel maps known statuses', () => {
  setLocale('zh-CN')
  assert.equal(docsSessionStatusLabel('active'), '进行中')
  assert.equal(docsSessionStatusLabel('unknown_x'), 'unknown_x')
})

test('docsSessionStatusClass buckets waiting states', () => {
  assert.equal(docsSessionStatusClass('failed'), 'waiting')
  assert.equal(docsSessionStatusClass('active'), 'active')
})

test('docsFileLabel step naming', () => {
  assert.match(docsFileLabel({ kind: 'step', name: 'step-03.md' }), /step-03/)
})
