import test from 'node:test'
import assert from 'node:assert/strict'
import {
  wrapBracketedPaste,
  chunkBracketedPaste,
  buildFurnaceSubmitSequence,
  BRACKET_START,
  BRACKET_END,
} from '../src/composables/bracketedPaste.js'

test('wrapBracketedPaste adds markers', () => {
  const w = wrapBracketedPaste('a\nb')
  assert.ok(w.startsWith(BRACKET_START))
  assert.ok(w.endsWith(BRACKET_END))
})

test('chunkBracketedPaste preserves bracket boundaries', () => {
  const chunks = chunkBracketedPaste('x'.repeat(5000), { size: 2000 })
  assert.ok(chunks.length >= 2)
  assert.ok(chunks[0].startsWith(BRACKET_START))
  assert.ok(chunks.at(-1).endsWith(BRACKET_END))
})

test('buildFurnaceSubmitSequence splits submit', () => {
  const r = buildFurnaceSubmitSequence('line1\nline2')
  assert.ok(r.payload.includes(BRACKET_START))
  assert.equal(r.submit, '\r')
})
