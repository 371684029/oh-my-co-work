import assert from 'node:assert/strict'
import test from 'node:test'

const { renderDocsFence, plainCodeBase64, plainCodeFromBase64, resolveDocsCodeLang } =
  await import('../src/views/docs/docsCodeFence.js')

test('resolveDocsCodeLang aliases common fence tags', () => {
  assert.equal(resolveDocsCodeLang('js'), 'javascript')
  assert.equal(resolveDocsCodeLang('py'), 'python')
})

test('plainCode base64 round-trip', () => {
  const s = '中文\nline2'
  assert.equal(plainCodeFromBase64(plainCodeBase64(s)), s)
})

test('renderDocsFence line numbers wrap each row', () => {
  const html = renderDocsFence('a\nb', 'text', { lineNumbers: true })
  assert.ok(html.includes('docs-code-line'))
  assert.ok(html.includes('docs-code-ln'))
  assert.ok(html.includes('>1<'))
  assert.ok(html.includes('>2<'))
})
