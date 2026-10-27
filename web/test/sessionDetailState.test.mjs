import assert from 'node:assert/strict'
import test from 'node:test'
import {
  terminalBridge,
  flowScrollTimerRef,
  sessions,
  groups,
  members,
  slashCommands,
  detail,
  activeId,
  editTitle,
  sessionNotesDraft,
  startTarget,
  startingChat,
  sending,
  gating,
  senderRef,
  composerHistIndex,
  composerHistIndexRef,
  composerDraftTimerRef,
  hashInsertLockUntil,
  hashInsertLockUntilRef,
  bumpHashInsertLock,
  clearHashInsertLock,
  pendingFiles,
  uploading,
  announceLoading,
  announceOpenLoading,
  notesSaving,
  terminalPrefs,
  furnaceSurface,
  listFilter,
  deleteSessionRef,
  gateActionsRef,
} from '../src/views/workbench/composables/sessionDetailState.js'

test('sessionDetailState refs are readable/writable', () => {
  assert.deepEqual(sessions.value, [])
  sessions.value = [{ id: 's1' }]
  assert.equal(sessions.value[0].id, 's1')
  sessions.value = []
  assert.equal(activeId.value, null)
  activeId.value = 'a1'
  assert.equal(activeId.value, 'a1')
  activeId.value = null
  assert.equal(editTitle.value, '')
  editTitle.value = '标题'
  assert.equal(editTitle.value, '标题')
  editTitle.value = ''
  assert.equal(listFilter.value, 'all')
  listFilter.value = 'pinned'
  assert.equal(listFilter.value, 'pinned')
  listFilter.value = 'all'
  assert.equal(furnaceSurface.value, 'tui')
  assert.equal(terminalPrefs.value.theme, 'project-dark')
  assert.equal(composerHistIndex, -1)
})

test('bumpHashInsertLock sets a future deadline; clearHashInsertLock resets it', () => {
  const before = Date.now()
  bumpHashInsertLock()
  assert.ok(hashInsertLockUntil > before + 200)
  assert.equal(hashInsertLockUntilRef.until, hashInsertLockUntil)
  clearHashInsertLock()
  assert.equal(hashInsertLockUntil, 0)
  assert.equal(hashInsertLockUntilRef.until, 0)
})

test('composerHistIndexRef mirrors the mutable scalar via getter/setter', () => {
  composerHistIndexRef.index = 4
  assert.equal(composerHistIndex, 4)
  composerHistIndexRef.index = -1
  assert.equal(composerHistIndex, -1)
})

test('forward-ref bridge objects keep stable identities and defaults', () => {
  assert.equal(typeof deleteSessionRef.doDelete, 'function')
  assert.deepEqual(gateActionsRef, {})
  assert.equal(typeof terminalBridge, 'object')
  assert.deepEqual(terminalBridge, {})
  assert.equal(flowScrollTimerRef.id, 0)
  assert.equal(composerDraftTimerRef.id, 0)
})

test('remaining refs start empty/false', () => {
  assert.equal(detail.value, null)
  assert.deepEqual(slashCommands.value, [])
  assert.deepEqual(groups.value, [])
  assert.deepEqual(members.value, [])
  assert.deepEqual(pendingFiles.value, [])
  assert.equal(startTarget.value, '')
  assert.equal(startingChat.value, false)
  assert.equal(sending.value, false)
  assert.equal(gating.value, false)
  assert.equal(senderRef.value, null)
  assert.equal(uploading.value, false)
  assert.equal(announceLoading.value, false)
  assert.equal(announceOpenLoading.value, false)
  assert.equal(notesSaving.value, false)
})
