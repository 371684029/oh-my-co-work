import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatSessionTime,
  formatSessionIo,
} from '../src/views/workbench/composables/sessionFormatUtils.js'

test('formatSessionTime returns empty for falsy', () => {
  assert.equal(formatSessionTime(''), '')
})

test('formatSessionTime parses ISO', () => {
  const s = formatSessionTime('2026-01-15T12:00:00.000Z')
  assert.ok(s.length > 4)
})

test('formatSessionIo handles null and strings', () => {
  assert.equal(formatSessionIo(null), '（无）')
  assert.equal(formatSessionIo('hello'), 'hello')
})
