import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyComposerPanelPatch,
  atPanelStateFromText,
  hashPanelStateFromText,
  slashPanelStateFromText,
} from '../src/views/workbench/composables/sessionComposerSync.js'

test('slashPanelStateFromText opens on leading slash', () => {
  assert.deepEqual(slashPanelStateFromText('/editor foo'), {
    slashOpen: true,
    atOpen: false,
    hashOpen: false,
    slashQuery: 'editor',
  })
  assert.deepEqual(slashPanelStateFromText('hello'), {
    slashOpen: false,
    slashQuery: '',
  })
})

test('atPanelStateFromText detects trailing @query', () => {
  assert.deepEqual(atPanelStateFromText('hi @bob'), {
    atOpen: true,
    slashOpen: false,
    hashOpen: false,
    atQuery: 'bob',
  })
  assert.deepEqual(atPanelStateFromText('/cmd'), { atOpen: false, atQuery: '' })
})

test('hashPanelStateFromText respects lock and trailing hash', () => {
  assert.equal(hashPanelStateFromText('x #tag', { locked: true }), null)
  assert.deepEqual(hashPanelStateFromText('say #tag'), {
    hashOpen: true,
    slashOpen: false,
    atOpen: false,
    hashQuery: 'tag',
  })
})

test('applyComposerPanelPatch mutates store', () => {
  const store = { slashOpen: false }
  applyComposerPanelPatch(store, { slashOpen: true, slashQuery: 'a' })
  assert.equal(store.slashOpen, true)
  assert.equal(store.slashQuery, 'a')
})
