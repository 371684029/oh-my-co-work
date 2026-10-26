import assert from 'node:assert/strict'
import test from 'node:test'
import {
  membersT,
  membersToast,
  membersCloneName,
  membersRefineSavedHint,
  membersRestoreOk,
  membersRemoveConfirmBody,
} from '../src/composables/settingsMembersCopy.js'

test('settingsMembersCopy returns members page title and form copy', () => {
  assert.match(membersT('title'), /成员管理|Members/)
  assert.match(membersT('form.refine'), /炼化|Refine/)
  assert.match(membersToast('exportOk'), /导出|export/i)
})

test('membersCloneName and confirm bodies substitute values', () => {
  assert.match(membersCloneName('Alpha'), /Alpha/)
  assert.match(membersRemoveConfirmBody('Alpha'), /Alpha/)
  assert.match(membersRestoreOk(3), /3/)
})

test('membersRefineSavedHint composes refine save feedback', () => {
  assert.equal(membersRefineSavedHint({}, false), membersT('refineSaved.off'))
  const patched = membersRefineSavedHint({ refinePrep: { patched: ['a/b/newBranch.bat'] } }, true)
  assert.match(patched, /newBranch\.bat/)
  const fallback = membersRefineSavedHint({ refinePrep: { fallback: true } }, true)
  assert.match(fallback, /文档中心|docs hub/i)
})
