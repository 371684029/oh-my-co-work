import test from 'node:test'
import assert from 'node:assert/strict'
import {
  messageText,
  formatSize,
  fileIcon,
  adapterChoices,
} from '../src/views/workbench/composables/sessionMessageUtils.js'

test('messageText prefers content.text', () => {
  assert.equal(messageText({ content: { text: 'hi' } }), 'hi')
})

test('formatSize units', () => {
  assert.equal(formatSize(500), '500 B')
  assert.equal(formatSize(2048), '2.0 KB')
})

test('fileIcon by extension', () => {
  assert.equal(fileIcon({ name: 'a.pdf' }), '📄')
})

test('adapterChoices filters empty', () => {
  assert.deepEqual(adapterChoices({ content: { choices: ['a', '', null] } }), ['a'])
})
