import assert from 'node:assert/strict'
import test from 'node:test'

const { buildSearchHighlightRegex, lineNeedleFromContent } = await import(
  '../src/views/docs/docsInDocSearch.js'
)

test('buildSearchHighlightRegex matches query words', () => {
  const re1 = buildSearchHighlightRegex('foo bar')
  assert.ok(re1)
  assert.ok(re1.test('hello foo world'))
  const re2 = buildSearchHighlightRegex('foo bar')
  assert.ok(re2.test('bar baz'))
})

test('lineNeedleFromContent picks trimmed line text', () => {
  const md = '# Title\n\nfind me here\n'
  assert.equal(lineNeedleFromContent(md, 3), 'find me here')
  assert.equal(lineNeedleFromContent(md, 99, 'fallback'), 'fallback')
})
