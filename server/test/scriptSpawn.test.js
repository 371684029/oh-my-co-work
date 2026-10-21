import assert from 'node:assert/strict'
import test from 'node:test'
import { buildScriptSummary, psSingleQuote } from '../src/runners/scriptSpawn.js'

test('psSingleQuote escapes single quotes', () => {
  assert.equal(psSingleQuote("a'b"), "'a''b'")
})

test('buildScriptSummary delegates to shared formatter', () => {
  const s = buildScriptSummary({ ok: true, exitCode: 0, stdout: 'ok', stderr: '', label: 'demo' })
  assert.match(String(s), /demo|成功|ok/i)
})
