import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionComposerFilterComputeds } from '../src/views/workbench/composables/sessionComposerFilterComputeds.js'

test('createSessionComposerFilterComputeds exposes filter lists', () => {
  const { filteredSlashCmds, filteredAtMembers } = createSessionComposerFilterComputeds({
    slashCommands: { value: [{ slash: '/x', name: 'X', enabled: true }] },
    members: { value: [] },
  })
  assert.equal(filteredSlashCmds.value.length, 1)
  assert.equal(filteredAtMembers.value.length, 0)
})
