import test from 'node:test'
import assert from 'node:assert/strict'
import { splitMessageDocLinks, journalPathToDocFile } from '../src/composables/messageDocLinks.js'

test('splitMessageDocLinks finds journal paths', () => {
  const parts = splitMessageDocLinks('see journals/sessions/s1/nodes/step-01-abc.md ok')
  assert.equal(parts.length, 3)
  assert.equal(parts[1].type, 'doc')
  assert.equal(parts[1].file, 'nodes/step-01-abc.md')
})

test('journalPathToDocFile normalizes rel paths', () => {
  assert.equal(
    journalPathToDocFile('journals/sessions/s1/nodes/step-02-x.md'),
    'nodes/step-02-x.md',
  )
})
