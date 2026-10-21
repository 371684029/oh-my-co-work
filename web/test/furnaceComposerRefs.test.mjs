import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveFurnaceComposerEl } from '../src/composables/furnaceComposerRefs.js'

test('resolveFurnaceComposerEl unwraps nested refs', () => {
  const el = { tag: 'textarea' }
  const inner = { value: el }
  const outer = { value: inner }
  assert.equal(resolveFurnaceComposerEl(outer), el)
  assert.equal(resolveFurnaceComposerEl(inner), el)
  assert.equal(resolveFurnaceComposerEl({ value: el }), el)
  assert.equal(resolveFurnaceComposerEl(null), null)
})
