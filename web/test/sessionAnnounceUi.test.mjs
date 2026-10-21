import test from 'node:test'
import assert from 'node:assert/strict'
import {
  cleanAnnounceIo,
  collectNodeHashParams,
  mapAnnounceProgressNode,
} from '../src/views/workbench/composables/sessionAnnounceUi.js'

test('cleanAnnounceIo drops empty placeholders', () => {
  assert.equal(cleanAnnounceIo('（无）'), '')
  assert.equal(cleanAnnounceIo('结果：ok'), '结果：ok')
})

test('collectNodeHashParams merges paramsList and # keys', () => {
  const hash = collectNodeHashParams({
    input: { paramsList: ['a'], params: { '#2': 'b' } },
  })
  assert.deepEqual(hash, [
    { key: '#1', value: 'a' },
    { key: '#2', value: 'b' },
  ])
})

test('mapAnnounceProgressNode builds row', () => {
  const row = mapAnnounceProgressNode(
    { id: 'n1', step_index: 0, title: 'T', status: 'succeeded', input: {}, output: {} },
    { formatIo: () => '', statusLabel: (s) => s },
  )
  assert.equal(row.id, 'n1')
  assert.equal(row.tagType, 'success')
})
