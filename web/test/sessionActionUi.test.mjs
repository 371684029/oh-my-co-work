import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveSessionId } from '../src/views/workbench/composables/sessionActionUi.js'

test('resolveSessionId ignores non-string click events', () => {
  assert.equal(resolveSessionId({}, 'active-1'), 'active-1')
  assert.equal(resolveSessionId('sid-9', 'active-1'), 'sid-9')
})
