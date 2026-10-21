import test from 'node:test'
import assert from 'node:assert/strict'
import { sessionStatusLabel, sessionStatusType } from '../src/views/workbench/composables/sessionStatusUi.js'

test('sessionStatusLabel maps waiting_human', () => {
  assert.equal(sessionStatusLabel('waiting_human'), '待确认')
})

test('sessionStatusType danger for waiting_human', () => {
  assert.equal(sessionStatusType('waiting_human'), 'danger')
})
