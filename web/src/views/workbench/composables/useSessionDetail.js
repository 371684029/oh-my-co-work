import { computed } from 'vue'
import { api } from '../../../api'
import { createSessionNotesActions } from './sessionNotesActions.js'
import { createSessionAnnounceActions } from './sessionAnnounceActions.js'
import { announceMdHintLabel } from './sessionWorkbenchFeedbackUi.js'
import { acwConfirm } from '../../../composables/acwConfirm.js'
import {
  messageText,
  formatSize,
  fileIcon,
  adapterChoices,
} from './sessionMessageUtils.js'
import { sessionStatusLabel, sessionStatusType } from './sessionStatusUi.js'
import { createSessionComposerFilterComputeds } from './sessionComposerFilterComputeds.js'
import { createSessionWorkbenchListComputeds } from './sessionWorkbenchListComputeds.js'
import { resetSessionDetailState } from './sessionDetailResetState.js'
import { registerSessionDetailWatchers } from './sessionDetailInitWatchers.js'
import { formatSessionTime } from './sessionFormatUtils.js'
import { isClonedNode, nodeHasAdapt, nodeHasRefine } from './sessionFlowUi.js'
import { CONVERSATION_MENU } from './sessionListUi.js'
import {
  computeOffsiteActive,
  findActiveOffsiteNode,
  computeOffsiteMode,
} from './sessionOffsiteUi.js'
import { reviewAction, reviewLabel } from './sessionReviewUi.js'
import { createSessionContextComputeds } from './sessionContextComputeds.js'
import { createSessionNodePresentation } from './sessionNodePresentation.js'
import { resolveAnnounceMdRelativePath } from './sessionDocsNavUi.js'
import { createSessionSenderInputBridge } from './sessionSenderInputBridge.js'
import { createSessionGateAndBubbleComputeds } from './sessionGateAndBubbleComputeds.js'
import { createSessionFlowAnchorComputeds } from './sessionFlowAnchorComputeds.js'
import { createSessionDetailLifecycleActions } from './sessionDetailLifecycleActions.js'
import { createSessionDetailComposerActions } from './sessionDetailComposerActions.js'
import { createSessionDetailSendGateActions } from './sessionDetailSendGateActions.js'
import {
  terminalBridge, flowScrollTimerRef, sessions, groups, members, slashCommands,
  detail, activeId, editTitle, sessionNotesDraft, startTarget, startingChat,
  sending, gating, senderRef, composerHistIndexRef, composerDraftTimerRef,
  hashInsertLockUntilRef, bumpHashInsertLock, clearHashInsertLock,
  pendingFiles, uploading, announceLoading, announceOpenLoading, notesSaving,
  terminalPrefs, furnaceSurface, listFilter, deleteSessionRef, gateActionsRef,
} from './sessionDetailState.js'

/**
 * 会话详情 / 消息 / 闸门 / 流程轨 / 群报告 的装配层（furnaceUi.js 同款单例模式）。
 * 状态本体在 sessionDetailState.js（FE-01/ENG-04 拆分）；终端相关经 terminalBridge 注入。
 */

// ===== 路由上下文（由 initSessionDetail 注入）=====
let _router = null
let _route = null
let _stopWatchers = []

const { readSenderText, readSenderTextRaw, replaceSenderText, appendSenderText, clearSender } =
  createSessionSenderInputBridge({ senderRef, bumpHashInsertLock })

const { filteredSlashCmds, filteredAtMembers } = createSessionComposerFilterComputeds({
  slashCommands,
  members,
})

const { filterOptions, startableMembers, conversationItems } =
  createSessionWorkbenchListComputeds({ sessions, members, listFilter })

const {
  sessionParamsList,
  sessionGroupCard,
  sessionGroupFolder,
  hashItems,
  filteredHashItems,
} = createSessionContextComputeds({ detail, activeId })

const offsiteActive = computed(() =>
  computeOffsiteActive(detail.value?.session, detail.value?.nodes),
)

const activeOffsiteNode = computed(() =>
  findActiveOffsiteNode(detail.value?.nodes, detail.value?.session?.context),
)

const offsiteMode = computed(() =>
  computeOffsiteMode(
    detail.value?.session?.context,
    activeOffsiteNode.value,
    offsiteActive.value,
  ),
)

const {
  nodeBypassed,
  stepTypeLabel,
  roleLabel,
  shortSender,
  isPendingGate,
  isCurrent,
  isCurrentOffsiteSegment,
  offsiteEntryLabel,
  offsiteInvokedLabel,
  flowClass,
  toggleNodeExpand,
  formatIo,
} = createSessionNodePresentation({
  detail,
  members,
  getActiveOffsiteNodeId: () => activeOffsiteNode.value?.id,
  getOffsiteMode: () => offsiteMode.value,
})

const statusLabel = sessionStatusLabel
const statusType = sessionStatusType
const formatTime = formatSessionTime

const {
  bubbleList,
  pendingGate,
  footerCollapsedHint,
  needsHuman,
  archiveOutcomeTag,
  announceKickoff,
  announceUserNotes,
  announceProgress,
  composerPlaceholder,
  composerToolbarHint,
  showComposerHintI,
  composerFooterHint,
} = createSessionGateAndBubbleComputeds({
  detail,
  terminalBridge,
  messageText,
  roleLabel,
  shortSender,
  isPendingGate,
  statusLabel,
})

const {
  flowEntries,
  flowHistorySplitIndex,
  flowAnchorNodeId,
  scrollFlowToAnchor,
  clearFlowScrollTimer,
  isSkippedFlowGroupExpanded,
  toggleSkippedFlowGroup,
  isFlowHistoryNode,
} = createSessionFlowAnchorComputeds({
  detail,
  getActiveOffsiteId: () => activeOffsiteNode.value?.id,
  flowScrollTimerRef,
})

const convMenu = CONVERSATION_MENU

// ===== 生命周期类动作：load / docs / 删除 / 改名 / 会话菜单 / 开聊 / 续跑 =====

const {
  loadLists, loadDetail, selectSession, openDocsHub, onConvChange,
  doDelete, rename, togglePin, onConvMenu, startChat, startDemoChat,
  restartFromNode, goShortcuts,
} = createSessionDetailLifecycleActions({
  sessions, groups, members, slashCommands, startTarget, startingChat,
  terminalPrefs, furnaceSurface, detail, editTitle, sessionNotesDraft,
  activeId, gating, api, terminalBridge, acwConfirm,
  readSenderTextRaw, replaceSenderText, composerHistIndexRef,
  getRouter: () => _router,
  offsiteActive, scrollFlowToAnchor, deleteSessionRef,
})

/** 群报告 MD 路径提示（相对 dataRoot） */
const announceMdHint = computed(() =>
  announceMdHintLabel(resolveAnnounceMdRelativePath(detail.value, activeId.value)),
)

const { saveSessionNotes } = createSessionNotesActions({
  activeId,
  sessionNotesDraft,
  detail,
  notesSaving,
  api,
})

const { openAnnouncementMd, rebuildAnnouncement } = createSessionAnnounceActions({
  activeId,
  detail,
  announceOpenLoading,
  announceLoading,
  loadDetail,
  api,
})

// ===== 输入区动作：copy / 面板同步 / 开关 / 插入 / slash / 键盘 =====

const {
  copyComposerText, syncSlashFromInput, syncAtFromInput, syncHashFromInput,
  onSenderChange, toggleSlashPanel, closeComposerPanel, toggleAtPanel,
  toggleHashPanel, insertAtMember, insertHashItem, runSlash, onComposerKeydown,
} = createSessionDetailComposerActions({
  activeId, api, readSenderText, readSenderTextRaw, replaceSenderText,
  appendSenderText, clearSender, hashInsertLockUntilRef, composerDraftTimerRef,
  composerHistIndexRef, filteredSlashCmds, filteredAtMembers, filteredHashItems,
})

// ===== 发送 / 闸门动作（onSenderSubmit 先于闸门创建，两段式接线在工厂内部）=====

const {
  onSenderSubmit, submitHuman, approveSessionStart, gate, answerAdapterQuestion,
} = createSessionDetailSendGateActions({
  sending, uploading, gating, activeId, sessions, members, slashCommands,
  pendingFiles, pendingGate, filteredSlashCmds, readSenderText, clearSender,
  loadLists, selectSession, loadDetail, runSlash, composerHistIndexRef,
  gateActionsRef, api,
})

// ===== 生命周期（Workbench 装配层调用）=====

export function setWorkbenchContext({ route, router }) {
  _route = route
  _router = router
}

export function resetSessionState() {
  resetSessionDetailState(
    {
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
      pendingFiles,
      uploading,
      announceLoading,
      announceOpenLoading,
      notesSaving,
      listFilter,
      terminalPrefs,
      furnaceSurface,
    },
    { clearHashInsertLock },
  )
}

export function initSessionDetail({ route, router }) {
  setWorkbenchContext({ route, router })
  resetSessionState()
  registerSessionDetailWatchers({
    stopWatchers: _stopWatchers,
    pendingGate,
    activeId,
    detail,
    selectSession,
    flowAnchorNodeId,
    scrollFlowToAnchor,
  })
}

export function disposeSessionDetail() {
  clearFlowScrollTimer()
  _stopWatchers.forEach((stop) => stop())
  _stopWatchers = []
}

// ===== 对外导出：状态经 sessionDetailState 活绑定转发；动作为本文件装配结果 =====

export * from './sessionDetailState.js'

export {
  filteredSlashCmds, filteredAtMembers, filterOptions, startableMembers,
  conversationItems, bubbleList, pendingGate, sessionParamsList, sessionGroupCard,
  sessionGroupFolder, hashItems, filteredHashItems, footerCollapsedHint, needsHuman,
  archiveOutcomeTag, announceKickoff, announceUserNotes, announceProgress,
  composerPlaceholder, composerToolbarHint, showComposerHintI, composerFooterHint,
  offsiteActive, offsiteMode, activeOffsiteNode, flowEntries, flowHistorySplitIndex,
  flowAnchorNodeId, convMenu, readSenderText, readSenderTextRaw, replaceSenderText,
  appendSenderText, clearSender, copyComposerText, loadLists, loadDetail,
  selectSession, startChat, startDemoChat, togglePin, onConvChange, onConvMenu,
  openAnnouncementMd, openDocsHub, rebuildAnnouncement, saveSessionNotes,
  announceMdHint, adapterChoices, answerAdapterQuestion, syncSlashFromInput,
  syncAtFromInput, syncHashFromInput, onSenderChange, onComposerKeydown,
  toggleSlashPanel, closeComposerPanel, toggleAtPanel, toggleHashPanel,
  insertAtMember, insertHashItem, runSlash, onSenderSubmit, submitHuman,
  approveSessionStart, gate, goShortcuts, rename, doDelete, restartFromNode,
  toggleNodeExpand, formatIo, toggleSkippedFlowGroup, isSkippedFlowGroupExpanded,
  nodeHasAdapt, nodeHasRefine, isClonedNode, isFlowHistoryNode, flowClass, isCurrent,
  isCurrentOffsiteSegment, offsiteEntryLabel, offsiteInvokedLabel, reviewLabel,
  reviewAction, statusLabel, statusType, stepTypeLabel, nodeBypassed, formatTime,
  roleLabel, shortSender, messageText, formatSize, fileIcon,
}
