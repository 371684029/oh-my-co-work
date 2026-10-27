/**
 * Session detail lifecycle wiring (FE-01/ENG-04 extract from useSessionDetail.js).
 * 装配 load / docs-hub / delete / rename / conv-menu / start-chat / restart 动作。
 * deleteSessionRef 两段式接线封在内部：先建 deleteSessionRef 消费方，再回填 doDelete。
 */
import { useFlowStore } from '../../../stores/flow.js'
import { createSessionLoadActions } from './sessionLoadActions.js'
import { createSessionDocsHubActions } from './sessionDocsHubActions.js'
import { createSessionDeleteActions } from './sessionDeleteActions.js'
import { createSessionRenameActions } from './sessionRenameActions.js'
import { createSessionConvActions } from './sessionConvActions.js'
import { createSessionStartChatActions } from './sessionStartChatActions.js'
import { createSessionRestartActions } from './sessionRestartActions.js'
import { formatDocsHubSearchParams } from './sessionDocsNavUi.js'

export function createSessionDetailLifecycleActions({
  sessions,
  groups,
  members,
  slashCommands,
  startTarget,
  startingChat,
  terminalPrefs,
  furnaceSurface,
  detail,
  editTitle,
  sessionNotesDraft,
  activeId,
  gating,
  api,
  terminalBridge,
  acwConfirm,
  readSenderTextRaw,
  replaceSenderText,
  composerHistIndexRef,
  getRouter,
  offsiteActive,
  scrollFlowToAnchor,
  deleteSessionRef,
}) {
  const { loadLists, loadDetail, selectSession } = createSessionLoadActions({
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
    replaceSessionRoute: (route) => getRouter()?.replace(route),
  })

  const { openDocsHub } = createSessionDocsHubActions({
    activeId,
    clearDocsUnread: () => useFlowStore().clearDocsUnread(),
    navigateDocsInApp: (query) => {
      const router = getRouter()
      if (router) {
        router.push({ path: '/docs', query })
        return
      }
      window.location.assign(`/docs?${formatDocsHubSearchParams(query)}`)
    },
  })

  function onConvChange(item) {
    const id = item?.uniqueKey || item?.id
    if (id) selectSession(id)
  }

  const { doDelete } = createSessionDeleteActions({
    activeId,
    detail,
    loadLists,
    api,
    acwConfirm,
    terminalBridge,
    leaveWorkbench: () => getRouter()?.replace('/workbench'),
  })
  deleteSessionRef.doDelete = doDelete

  const { rename } = createSessionRenameActions({
    activeId,
    editTitle,
    sessions,
    api,
  })

  const { togglePin, onConvMenu } = createSessionConvActions({
    sessions,
    detail,
    activeId,
    editTitle,
    loadDetail,
    api,
    deleteSessionRef,
  })

  const { startChat, startDemoChat } = createSessionStartChatActions({
    startTarget,
    startingChat,
    groups,
    loadLists,
    selectSession,
    api,
  })

  const { restartFromNode } = createSessionRestartActions({
    activeId,
    detail,
    gating,
    sessions,
    offsiteActive,
    loadDetail,
    api,
    scrollFlowToAnchor,
  })

  function goShortcuts() {
    getRouter()?.push('/settings/shortcuts')
  }

  return {
    loadLists,
    loadDetail,
    selectSession,
    openDocsHub,
    onConvChange,
    doDelete,
    rename,
    togglePin,
    onConvMenu,
    startChat,
    startDemoChat,
    restartFromNode,
    goShortcuts,
  }
}
