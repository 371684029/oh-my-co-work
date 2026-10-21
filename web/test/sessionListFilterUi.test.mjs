import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSessionListFilterOptions } from '../src/views/workbench/composables/sessionListFilterUi.js'

test('buildSessionListFilterOptions returns three filters', () => {
  const opts = buildSessionListFilterOptions()
  assert.equal(opts.length, 3)
  assert.deepEqual(
    opts.map((o) => o.value),
    ['all', 'active', 'archived'],
  )
  assert.match(opts[0].label, /全部|All/)
})
