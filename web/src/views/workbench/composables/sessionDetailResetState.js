/** Reset module-level session detail refs (FE-01). */
import { useComposerStore } from '../../../stores/composer.js'
import { useFlowStore } from '../../../stores/flow.js'

export const defaultTerminalPrefs = () => ({
  theme: 'project-dark',
  fontSize: 13,
  cursorBlink: true,
  pastePolicy: 'confirm',
  autoCollapseOnExit: false,
  scrollback: 5000,
})

export function resetComposerStorePanels() {
  const store = useComposerStore()
  store.slashOpen = false
  store.slashQuery = ''
  store.slashIndex = 0
  store.atOpen = false
  store.atQuery = ''
  store.atIndex = 0
  store.hashOpen = false
  store.hashQuery = ''
  store.hashIndex = 0
  store.footerCollapsed = false
}

export function resetFlowStoreUi() {
  const flow = useFlowStore()
  flow.expandedNodeId = null
  flow.expandedSkippedFlowGroups = {}
  flow.rightTab = 'flow'
}

/** @param {Record<string, import('vue').Ref>} state */
export function resetSessionDetailState(state, { clearHashInsertLock }) {
  state.sessions.value = []
  state.groups.value = []
  state.members.value = []
  state.slashCommands.value = []
  state.detail.value = null
  state.activeId.value = null
  state.editTitle.value = ''
  state.sessionNotesDraft.value = ''
  state.startTarget.value = ''
  state.startingChat.value = false
  state.sending.value = false
  state.gating.value = false
  state.senderRef.value = null
  clearHashInsertLock?.()
  resetComposerStorePanels()
  state.pendingFiles.value = []
  state.uploading.value = false
  resetFlowStoreUi()
  state.announceLoading.value = false
  state.announceOpenLoading.value = false
  state.notesSaving.value = false
  state.listFilter.value = 'all'
  state.terminalPrefs.value = defaultTerminalPrefs()
  state.furnaceSurface.value = 'tui'
}
