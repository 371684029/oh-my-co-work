import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionContextComputeds } from '../src/views/workbench/composables/sessionContextComputeds.js'

test('createSessionContextComputeds exposes hash/session context refs', () => {
  const c = createSessionContextComputeds({
    detail: { value: null },
    activeId: { value: '' },
  })
  assert.equal(c.hashItems.value.length, 0)
  assert.equal(c.sessionParamsList.value.length, 0)
})
