import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canSendPlainMessage,
  composerSubmitRoute,
  pickSlashCommandOnSubmit,
  shouldSubmitHumanGate,
  shouldSessionStartGateOnSubmit,
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

test('shouldSessionStartGateOnSubmit for session_start', () => {
  const gate = { content: { mode: 'session_start' } }
  assert.equal(shouldSessionStartGateOnSubmit(gate, false), true)
  assert.equal(shouldSessionStartGateOnSubmit(gate, true), false)
})

test('composerSubmitRoute', () => {
  const startGate = { content: { mode: 'session_start' } }
  assert.equal(
    composerSubmitRoute({ text: '', gate: startGate, mentionAssistOnly: false, attachmentsCount: 0 }),
    'session_start_gate',
  )
  const gate = { content: { mode: 'human_input' } }
  assert.equal(composerSubmitRoute({ text: '/x', gate: null, mentionAssistOnly: false, attachmentsCount: 0 }), 'slash')
  assert.equal(
    composerSubmitRoute({ text: 'hi', gate, mentionAssistOnly: false, attachmentsCount: 0 }),
    'human_gate',
  )
  assert.equal(
    composerSubmitRoute({ text: 'hi', gate: null, mentionAssistOnly: false, attachmentsCount: 0 }),
    'plain_message',
  )
  assert.equal(
    composerSubmitRoute({ text: '', gate: null, mentionAssistOnly: false, attachmentsCount: 0 }),
    'noop',
  )
})
