import assert from 'node:assert/strict'
import test from 'node:test'
import { findGroupByTitle } from '../src/views/workbench/composables/sessionDemoFlowUi.js'

test('findGroupByTitle', () => {
  const g = findGroupByTitle([{ title: '演示流', id: 1 }])
  assert.equal(g.id, 1)
  assert.equal(findGroupByTitle([]), null)
})
