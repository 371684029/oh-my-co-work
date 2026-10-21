import assert from 'node:assert/strict'
import test from 'node:test'
import {
  filterStartableMembers,
  pickDefaultStartTarget,
  shouldSaveComposerDraftOnSessionSwitch,
  workbenchSessionRoute,
} from '../src/views/workbench/composables/sessionLoadListsUi.js'

test('filterStartableMembers and pickDefaultStartTarget', () => {
  assert.deepEqual(
    filterStartableMembers([
      { id: 'a', enabled: false },
      { id: 'b' },
    ]).map((m) => m.id),
    ['b'],
  )
  assert.equal(pickDefaultStartTarget([{ id: 'g1' }], []), 'g:g1')
  assert.equal(
    pickDefaultStartTarget([], [{ id: 'm1', enabled: false }, { id: 'm2' }]),
    'm:m2',
  )
  assert.equal(pickDefaultStartTarget([], []), '')
})

test('workbenchSessionRoute and draft switch guard', () => {
  assert.equal(workbenchSessionRoute('abc'), '/workbench/abc')
  assert.equal(workbenchSessionRoute(''), '/workbench')
  assert.equal(shouldSaveComposerDraftOnSessionSwitch('a', 'b'), true)
  assert.equal(shouldSaveComposerDraftOnSessionSwitch('a', 'a'), false)
  assert.equal(shouldSaveComposerDraftOnSessionSwitch('', 'b'), false)
})
