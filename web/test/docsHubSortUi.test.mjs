import assert from 'node:assert/strict'
import test from 'node:test'
import {
  docsHubSortOptions,
  readDocsHubSortMode,
  writeDocsHubSortMode,
} from '../src/views/docs/docsHubSortUi.js'

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }
}

test('docsHubSortOptions returns group and time', () => {
  const t = (k) => k
  const opts = docsHubSortOptions(t)
  assert.equal(opts.length, 2)
  assert.deepEqual(opts.map((o) => o.value), ['group', 'time'])
})

test('read/write docs hub sort mode', () => {
  writeDocsHubSortMode('time')
  assert.equal(readDocsHubSortMode(), 'time')
  writeDocsHubSortMode('group')
  assert.equal(readDocsHubSortMode(), 'group')
})
