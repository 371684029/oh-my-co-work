/** Session list/detail load and select (FE-01 extract from useSessionDetail). */
import { useFlowStore } from '../../../stores/flow.js'
import {
  composerScopeKey,
  loadInputDraft,
  saveInputDraft,
} from '../../../composables/inputDraftHistory.js'
import { pickDefaultStartTarget, shouldSaveComposerDraftOnSessionSwitch, workbenchSessionRoute } from './sessionLoadListsUi.js'

export function createSessionLoadActions({
  sessions,
  groups,
  members,
  slashCommands,
  startTarget,
  terminalPrefs,
  furnaceSurface,
  detail,
  editTitle,
  sessionNotesDraft,
  activeId,
  api,
  terminalBridge,
  readSenderTextRaw,
  replaceSenderText,
  composerHistIndexRef,
  replaceSessionRoute,
}) {
  async function loadLists() {
    sessions.value = await api.sessions.list()
    groups.value = await api.groups.list()
    members.value = await api.members.list()
    if (!startTarget.value) {
      const picked = pickDefaultStartTarget(groups.value, members.value)
      if (picked) startTarget.value = picked
    }
    try {
      const sc = await api.slashCommands.list()
      slashCommands.value = sc.commands || []
    } catch {
      slashCommands.value = []
    }
    try {
      const s = await api.appSettings.get()
      if (s?.terminal) terminalPrefs.value = { ...terminalPrefs.value, ...s.terminal }
      furnaceSurface.value = 'tui'
    } catch {
      /* keep defaults */
    }
  }

  async function loadDetail(id) {
    detail.value = await api.sessions.get(id)
    editTitle.value = detail.value.session.title
    sessionNotesDraft.value = detail.value.session?.context?.notes || ''
  }

  async function selectSession(id) {
    if (!id) return
    const prev = activeId.value
    if (shouldSaveComposerDraftOnSessionSwitch(prev, id)) {
      saveInputDraft(composerScopeKey(prev), readSenderTextRaw())
    }
    composerHistIndexRef.index = -1
    activeId.value = id
    terminalBridge.resetTerminals?.()
    replaceSessionRoute(workbenchSessionRoute(id))
    useFlowStore().rightTab = 'flow'
    useFlowStore().expandedSkippedFlowGroups = {}
    terminalBridge.bindWs?.(id)
    await Promise.all([loadDetail(id), terminalBridge.loadTerminals?.(id)])
    terminalBridge.revealFurnaceTui?.()
    const savedDraft = loadInputDraft(composerScopeKey(id))
    if (savedDraft) await replaceSenderText(savedDraft)
  }

  return { loadLists, loadDetail, selectSession }
}
