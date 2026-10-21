import assert from 'node:assert/strict'
import test from 'node:test'

const { slugifyHeading, outlineWithUniqueSlugs } = await import('../src/views/docs/docOutline.js')

test('slugifyHeading normalizes CJK and punctuation', () => {
  assert.equal(slugifyHeading('Hello World!'), 'hello-world')
  assert.equal(slugifyHeading('  标题一  '), '标题一')
})

test('outlineWithUniqueSlugs matches duplicate heading suffixes', () => {
  const md = '# A\n## B\n## B\n'
  const items = outlineWithUniqueSlugs(md, { maxLevel: 3 })
  assert.deepEqual(
    items.map((i) => i.slug),
    ['a', 'b', 'b-2'],
  )
})
