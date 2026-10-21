import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildHashComposerItems,
  filterHashComposerItems,
} from '../src/views/workbench/composables/sessionHashUi.js'

test('buildHashComposerItems includes group, params, and outputs', () => {
  const items = buildHashComposerItems({
    groupCard: 'G',
    groupFolder: '/tmp',
    paramsList: ['p1'],
    nodes: [{ title: 'Step', step_index: 0, output: { text: 'out' } }],
    maxParams: 99,
    wholeOutputText: (o) => o?.text || '',
  })
  assert.ok(items.some((h) => h.key === '群聊'))
  assert.ok(items.some((h) => h.key === '1' && h.value === 'p1'))
  assert.ok(items.some((h) => h.key === '出1'))
})

test('filterHashComposerItems adds numeric slot when missing', () => {
  const base = buildHashComposerItems({ paramsList: ['a'], maxParams: 99 })
  const filtered = filterHashComposerItems(base, '2', { maxParams: 99, paramsList: ['a', 'b'] })
  assert.ok(filtered.some((h) => h.key === '2' && h.value === 'b'))
})
