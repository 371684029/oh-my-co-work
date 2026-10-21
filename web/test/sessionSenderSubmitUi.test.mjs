import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canSendPlainMessage,
  pickSlashCommandOnSubmit,
  shouldSubmitHumanGate,
} from '../src/views/workbench/composables/sessionSenderSubmitUi.js'

test('pickSlashCommandOnSubmit resolves token', () => {
  const cmds = [{ slash: 'help', enabled: true }]
  assert.equal(pickSlashCommandOnSubmit('/help', cmds, null)?.slash, 'help')
  assert.equal(pickSlashCommandOnSubmit('hi', cmds, null), null)
})

test('shouldSubmitHumanGate respects mention assist', () => {
  const gate = { content: { mode: 'human_input' } }
  assert.equal(shouldSubmitHumanGate(gate, true), false)
  assert.equal(shouldSubmitHumanGate(gate, false), true)
  assert.equal(shouldSubmitHumanGate(null, false), false)
})

test('canSendPlainMessage', () => {
  assert.equal(canSendPlainMessage('', 0), false)
  assert.equal(canSendPlainMessage('x', 0), true)
  assert.equal(canSendPlainMessage('', 1), true)
})
