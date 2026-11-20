import assert from 'node:assert/strict'
import test from 'node:test'
import { api } from '../src/api.js'

test('api.furnace keeps focus, skills, and prepare on one object', () => {
  assert.equal(typeof api.furnace.focus, 'function')
  assert.equal(typeof api.furnace.setFocus, 'function')
  assert.equal(typeof api.furnace.skills, 'function')
  assert.equal(typeof api.furnace.syncSkills, 'function')
  assert.equal(typeof api.furnace.prepare, 'function')
})
