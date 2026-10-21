import assert from 'node:assert/strict'
import test from 'node:test'

const { readDocsReadingPrefs, docsReadingClassNames } = await import(
  '../src/views/docs/docsReadingPrefs.js'
)

test('readDocsReadingPrefs falls back to defaults', () => {
  const p = readDocsReadingPrefs()
  assert.equal(p.width, 'standard')
  assert.ok(p.fontScale >= 0.9)
})

test('docsReadingClassNames includes width and theme', () => {
  const cls = docsReadingClassNames({ width: 'wide', theme: 'dark', fontScale: 1, focus: true })
  assert.ok(cls.includes('docs-read-width-wide'))
  assert.ok(cls.includes('docs-read-theme-dark'))
  assert.ok(cls.includes('docs-read-focus'))
})
