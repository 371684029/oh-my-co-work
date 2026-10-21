import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatInDocSearchPager,
  stepInDocSearchIndex,
} from '../src/views/docs/docsHubInDocSearchUi.js'

test('formatInDocSearchPager', () => {
  assert.equal(formatInDocSearchPager(0, 3), '1 / 3')
  assert.equal(formatInDocSearchPager(0, 0), '')
})

test('stepInDocSearchIndex wraps', () => {
  assert.equal(stepInDocSearchIndex(0, -1, 3), 2)
})
