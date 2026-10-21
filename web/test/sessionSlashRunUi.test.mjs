import assert from 'node:assert/strict'
import test from 'node:test'
import {
  slashCommandNotFoundMessage,
  slashNeedsUrlPrompt,
} from '../src/views/workbench/composables/sessionSlashRunUi.js'
import { setLocale } from '../src/i18n/index.js'

test('slashNeedsUrlPrompt', () => {
  assert.equal(slashNeedsUrlPrompt({ kind: 'url', promptForUrl: true }), true)
  assert.equal(slashNeedsUrlPrompt({ kind: 'agent' }), false)
})

test('slashCommandNotFoundMessage', () => {
  setLocale('en-US')
  assert.match(slashCommandNotFoundMessage('foo'), /foo/)
  setLocale('zh-CN')
})
