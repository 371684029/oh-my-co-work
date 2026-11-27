import assert from 'node:assert/strict'
import test from 'node:test'
import {
  docsFileLabel,
  docsHubListItemLabel,
  docsHubPrimaryTitle,
  docsHubFileSubtitle,
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

test('docsHubPrimaryTitle announce uses group chat name', () => {
  setLocale('zh-CN')
  const file = { kind: 'announce', name: 'ANNOUNCEMENT.md' }
  const session = {
    groupTitle: '原型到提测',
    sessionTitle: '退库管理新增配件丢件登记+售后工单 · 原型',
  }
  assert.equal(docsHubPrimaryTitle(file, session), '原型到提测')
  assert.equal(
    docsHubListItemLabel({ ...file, ...session }),
  '原型到提测',
  )
  assert.match(docsHubFileSubtitle(file), /群报告/)
  assert.match(docsHubFileSubtitle(file), /ANNOUNCEMENT/)
})

test('docsHubListItemLabel non-announce keeps session + kind', () => {
  setLocale('zh-CN')
  const label = docsHubListItemLabel({
    kind: 'step',
    name: 'step-01.md',
    sessionTitle: '会话 A',
  })
  assert.match(label, /会话 A/)
  assert.match(label, /节点台账/)
})
