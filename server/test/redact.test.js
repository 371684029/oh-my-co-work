import assert from 'node:assert/strict'
import test from 'node:test'
import { redactText } from '../src/terminal/redact.js'

test('redactText masks common tokens and custom regex', () => {
  const sample = 'token=abc secret=xyz sk-abcdefghijklmnopqrstuvwxyz ghp_abcdefghijklmnopqrstuv'
  const out = redactText(sample, { enabled: true })
  assert.match(out, /\[REDACTED\]/)
  assert.equal(out.includes('sk-abcdefghijklmnopqrstuvwxyz'), false)
  const custom = redactText('AKIAIOSFODNN7EXAMPLE', {
    enabled: true,
    patternsText: 'AKIA[0-9A-Z]{16}',
  })
  assert.equal(custom, '[REDACTED]')
  assert.equal(redactText('sk-abcdefghijklmnopqrstuvwxyz', { enabled: false }).includes('sk-'), true)
})
