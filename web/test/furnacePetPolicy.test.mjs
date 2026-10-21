import test from 'node:test'
import assert from 'node:assert/strict'
import {
  shouldShowFurnacePet,
  normalizeFurnacePetPolicy,
} from '../src/composables/furnacePetPolicy.js'

test('shouldShowFurnacePet hides on docs by default', () => {
  assert.equal(
    shouldShowFurnacePet({ routePath: '/docs', policy: normalizeFurnacePetPolicy() }),
    false,
  )
})

test('shouldShowFurnacePet shows on workbench', () => {
  assert.equal(
    shouldShowFurnacePet({ routePath: '/workbench/abc', policy: normalizeFurnacePetPolicy() }),
    true,
  )
})
