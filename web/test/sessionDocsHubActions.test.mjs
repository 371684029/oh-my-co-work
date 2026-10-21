import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionDocsHubActions } from '../src/views/workbench/composables/sessionDocsHubActions.js'

test('createSessionDocsHubActions exposes openDocsHub', () => {
  const actions = createSessionDocsHubActions({
    activeId: { value: '' },
    clearDocsUnread: () => {},
    navigateDocsInApp: () => {},
  })
  assert.equal(typeof actions.openDocsHub, 'function')
})
