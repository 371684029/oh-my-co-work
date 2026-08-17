import assert from 'node:assert/strict'
import test from 'node:test'
import { inspectTerminalPaste } from '@acw/shared'

test('single keystrokes and one-line paste are sent without a prompt', () => {
  assert.equal(inspectTerminalPaste('a', 'confirm').action, 'send')
  assert.equal(inspectTerminalPaste('ls\r', 'confirm').action, 'send')
  assert.equal(inspectTerminalPaste('\x03', 'confirm').risky, false)
})

test('multiline paste asks for confirmation by default', () => {
  const r = inspectTerminalPaste('echo one\necho two\n', 'confirm')
  assert.equal(r.action, 'confirm')
  assert.equal(r.risky, true)
  assert.ok(r.lines >= 2)
})

test('allow policy sends multiline paste', () => {
  assert.equal(inspectTerminalPaste('a\nb\n', 'allow').action, 'send')
})

test('reject policy blocks multiline and oversized paste', () => {
  assert.equal(inspectTerminalPaste('a\nb\n', 'reject').action, 'reject')
  assert.equal(inspectTerminalPaste('x'.repeat(800), 'reject').action, 'reject')
  assert.equal(inspectTerminalPaste('ok', 'reject').action, 'send')
})
