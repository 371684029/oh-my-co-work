import assert from 'node:assert/strict'
import test from 'node:test'
import {
  groupsT,
  groupsToast,
  groupsCloneName,
  groupsStartTitle,
  groupsBatchAdded,
  groupsAdminInheritNamed,
  groupsFlowTags,
} from '../src/composables/settingsGroupsCopy.js'

test('settingsGroupsCopy returns groups page title and form copy', () => {
  assert.match(groupsT('title'), /群聊模板|Group templates/)
  assert.match(groupsT('admin.title'), /熔炉|Furnace/)
  assert.match(groupsToast('saved'), /保存|Saved/)
})

test('groups helpers substitute values', () => {
  assert.match(groupsCloneName('Team'), /Team/)
  assert.match(groupsStartTitle('Team'), /Team/)
  assert.match(groupsBatchAdded(2), /2/)
  assert.match(groupsAdminInheritNamed('Admin'), /Admin/)
})

test('groupsFlowTags maps flow keys to labels', () => {
  const tags = groupsFlowTags(['admin', 'auto', 'human'])
  assert.equal(tags.length, 3)
  assert.ok(tags.every((s) => typeof s === 'string' && s))
})
