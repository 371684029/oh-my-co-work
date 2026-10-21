import { ref, computed, watch } from 'vue'
import { api } from '../../../api'
import { useComposerStore } from '../../../stores/composer.js'
import { useFlowStore } from '../../../stores/flow.js'
import { createSessionConvActions } from './sessionConvActions.js'
import { createSessionStartChatActions } from './sessionStartChatActions.js'
import { createSessionNotesActions } from './sessionNotesActions.js'
import { createSessionAnnounceActions } from './sessionAnnounceActions.js'
import { createSessionDeleteActions } from './sessionDeleteActions.js'
import { createSessionRenameActions } from './sessionRenameActions.js'
import { createSessionDocsHubActions } from './sessionDocsHubActions.js'
import { createSessionComposerCopyActions } from './sessionComposerCopyActions.js'
import { createSessionRestartActions } from './sessionRestartActions.js'
import { createSessionSlashActions } from './sessionSlashActions.js'
import { announceMdHintLabel } from './sessionWorkbenchFeedbackUi.js'
import { acwConfirm } from '../../../composables/acwConfirm.js'
import {
  messageText,
  formatSize,
  fileIcon,
  adapterChoices,
} from './sessionMessageUtils.js'
import { sessionStatusLabel, sessionStatusType } from './sessionStatusUi.js'
import { buildSessionListFilterOptions } from './sessionListFilterUi.js'
import { createSessionMessageSendActions } from './sessionMessageSendActions.js'
import { formatSessionTime } from './sessionFormatUtils.js'
import { isClonedNode, nodeHasAdapt, nodeHasRefine } from './sessionFlowUi.js'
import { buildConversationItems, CONVERSATION_MENU } from './sessionListUi.js'
import {
  computeOffsiteActive,
  findActiveOffsiteNode,
  computeOffsiteMode,
} from './sessionOffsiteUi.js'
import { reviewAction, reviewLabel } from './sessionReviewUi.js'
import { createSessionContextComputeds } from './sessionContextComputeds.js'
import { createSessionNodePresentation } from './sessionNodePresentation.js'
import { formatDocsHubSearchParams, resolveAnnounceMdRelativePath } from './sessionDocsNavUi.js'
import { createSessionGateActions } from './sessionGateActions.js'
import { createSessionLoadActions } from './sessionLoadActions.js'
import { createSessionComposerPanelSyncActions } from './sessionComposerPanelSyncActions.js'
import { createSessionComposerPanelToggleActions } from './sessionComposerPanelToggleActions.js'
import { createSessionComposerInsertActions } from './sessionComposerInsertActions.js'
import { createSessionComposerKeydownActions } from './sessionComposerKeydownActions.js'
import { createSessionSenderInputBridge } from './sessionSenderInputBridge.js'
import { createSessionGateAndBubbleComputeds } from './sessionGateAndBubbleComputeds.js'
import { createSessionFlowAnchorComputeds } from './sessionFlowAnchorComputeds.js'
import { nextGateIdempotencyKey } from './sessionGateIdempotency.js'


/**
 * 会话详情 / 消息 / 闸门 / 流程轨 / 群报告 的模块级单例状态（furnaceUi.js 同款模式）。
 * 终端相关（WS / replay / seq）在 useTerminalSessions.js，经 terminalBridge 注入以打破循环依赖。
 */

// ===== 终端桥：由 useTerminalSessions 注入 =====
export const terminalBridge = {}

// ===== 路由上下文（由 initSessionDetail 注入）=====
let _router = null
let _route = null
let _stopWatchers = []
const flowScrollTimerRef = { id: 0 }

// ===== 列表 =====
const sessions = ref([])
const groups = ref([])
const members = ref([])
const slashCommands = ref([])

// ===== 会话详情 =====
const detail = ref(null)
const activeId = ref(null)
const editTitle = ref('')
const sessionNotesDraft = ref('')

// ===== 开聊 =====
const startTarget = ref('')
const startingChat = ref(false)

// ===== 发送 / 闸门 =====
const sending = ref(false)
const gating = ref(false)

// ===== 输入区 =====
/** XSender 实例：该组件无可靠 v-model，提交时用 ref 取文 */
const senderRef = ref(null)
let composerHistIndex = -1
const composerHistIndexRef = {
  get index() {
    return composerHistIndex
  },
  set index(v) {
    composerHistIndex = v
  },
}
const composerDraftTimerRef = { id: 0 }
const hashInsertLockUntilRef = {
  get until() {
    return hashInsertLockUntil
  },
}
/** 刚用 # 快捷覆写输入框后，短暂忽略 sync，避免面板闪回 */
let hashInsertLockUntil = 0
function bumpHashInsertLock() {
  hashInsertLockUntil = Date.now() + 300
}

const { readSenderText, readSenderTextRaw, replaceSenderText, appendSenderText, clearSender } =
  createSessionSenderInputBridge({ senderRef, bumpHashInsertLock })

/** 待发送附件 */
const pendingFiles = ref([])
const uploading = ref(false)

// ===== 流程轨 =====

// ===== 群报告 =====
const announceLoading = ref(false)
const announceOpenLoading = ref(false)
const notesSaving = ref(false)

// ===== 终端偏好 / 熔炉表面 =====
const terminalPrefs = ref({
  theme: 'project-dark',
  fontSize: 13,
  cursorBlink: true,
  pastePolicy: 'confirm',
  autoCollapseOnExit: false,
  scrollback: 5000,
})
const furnaceSurface = ref('tui')

// ===== 会话列表筛选 =====
const listFilter = ref('all')

const filteredSlashCmds = computed(() => {
  const q = (useComposerStore().slashQuery || '').toLowerCase()
  const list = slashCommands.value.filter((c) => c.enabled !== false)
  if (!q) return list
  return list.filter(
    (c) =>
      c.slash.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q),
  )
})

const filteredAtMembers = computed(() => {
  const q = (useComposerStore().atQuery || '').toLowerCase().trim()
  const list = members.value || []
  if (!q) return list
  return list.filter(
    (m) =>
      String(m.display_name || '')
        .toLowerCase()
        .includes(q) ||
      String(m.name || '')
        .toLowerCase()
        .includes(q) ||
      String(m.config?.description || '')
        .toLowerCase()
        .includes(q),
  )
})

const filterOptions = computed(() => buildSessionListFilterOptions())

/** 开聊可选成员（启用中） */
const startableMembers = computed(() =>
  (members.value || []).filter((m) => m.enabled !== false),
)

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

/** 会话历史两大块：群模板 / 成员（块内置顶+时间已在 filteredSessions 排好） */
const conversationItems = computed(() =>
  buildConversationItems(sessions.value, listFilter.value),
)

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
  replaceSessionRoute: (route) => _router?.replace(route),
})

/** 群报告 MD 路径提示（相对 dataRoot） */
const announceMdHint = computed(() =>
  announceMdHintLabel(resolveAnnounceMdRelativePath(detail.value, activeId.value)),
)

const { openDocsHub } = createSessionDocsHubActions({
  activeId,
  clearDocsUnread: () => useFlowStore().clearDocsUnread(),
  navigateDocsInApp: (query) => {
    if (_router) {
      _router.push({ path: '/docs', query })
      return
    }
    const qs = formatDocsHubSearchParams(query)
    window.location.assign(`/docs?${qs}`)
  },
})

function onConvChange(item) {
  const id = item?.uniqueKey || item?.id
  if (id) selectSession(id)
}

const deleteSessionRef = { doDelete: async () => {} }

const { doDelete } = createSessionDeleteActions({
  activeId,
  detail,
  loadLists,
  api,
  acwConfirm,
  terminalBridge,
  leaveWorkbench: () => _router?.replace('/workbench'),
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

const { copyComposerText } = createSessionComposerCopyActions({ readSenderText })

const { syncSlashFromInput, syncAtFromInput, syncHashFromInput, onSenderChange } =
  createSessionComposerPanelSyncActions({
    activeId,
    readSenderText,
    readSenderTextRaw,
    hashInsertLockUntilRef,
    draftTimerRef: composerDraftTimerRef,
  })

const { toggleSlashPanel, closeComposerPanel, toggleAtPanel, toggleHashPanel } =
  createSessionComposerPanelToggleActions({
    readSenderText,
    readSenderTextRaw,
    appendSenderText,
    syncSlashFromInput,
    syncAtFromInput,
    syncHashFromInput,
  })

const { insertAtMember, insertHashItem } = createSessionComposerInsertActions({
  readSenderText,
  readSenderTextRaw,
  replaceSenderText,
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
  _router.push('/settings/shortcuts')
}

const { runSlash } = createSessionSlashActions({
  activeId,
  readSenderTextRaw,
  clearSender,
  replaceSenderText,
  api,
})

const { onComposerKeydown } = createSessionComposerKeydownActions({
  activeId,
  readSenderText,
  readSenderTextRaw,
  replaceSenderText,
  composerHistIndexRef,
  filteredHashItems,
  filteredAtMembers,
  filteredSlashCmds,
  syncSlashFromInput,
  syncAtFromInput,
  syncHashFromInput,
  insertAtMember,
  insertHashItem,
  runSlash,
})

const gateActionsRef = {}

const { onSenderSubmit } = createSessionMessageSendActions({
  sending,
  uploading,
  readSenderText,
  pendingGate,
  members,
  slashCommands,
  filteredSlashCmds,
  activeId,
  pendingFiles,
  clearSender,
  loadLists,
  selectSession,
  loadDetail,
  sessions,
  runSlash,
  submitHuman: (m) => gateActionsRef.submitHuman(m),
  api,
  composerHistIndexRef,
})

const nextIdempotencyKey = nextGateIdempotencyKey

const { submitHuman, approveSessionStart, gate, answerAdapterQuestion } = createSessionGateActions({
  gating,
  activeId,
  members,
  readSenderText,
  clearSender,
  loadDetail,
  sessions,
  nextIdempotencyKey,
  onSenderSubmit,
  api,
})
Object.assign(gateActionsRef, { submitHuman, approveSessionStart, gate, answerAdapterQuestion })

// ===== 生命周期（Workbench 装配层调用）=====

export function setWorkbenchContext({ route, router }) {
  _route = route
  _router = router
}

export function resetSessionState() {
  sessions.value = []
  groups.value = []
  members.value = []
  slashCommands.value = []
  detail.value = null
  activeId.value = null
  editTitle.value = ''
  sessionNotesDraft.value = ''
  startTarget.value = ''
  startingChat.value = false
  sending.value = false
  gating.value = false
  senderRef.value = null
  hashInsertLockUntil = 0
  useComposerStore().slashOpen = false
  useComposerStore().slashQuery = ''
  useComposerStore().slashIndex = 0
  useComposerStore().atOpen = false
  useComposerStore().atQuery = ''
  useComposerStore().atIndex = 0
  useComposerStore().hashOpen = false
  useComposerStore().hashQuery = ''
  useComposerStore().hashIndex = 0
  pendingFiles.value = []
  uploading.value = false
  useComposerStore().footerCollapsed = false
  useFlowStore().expandedNodeId = null
  useFlowStore().expandedSkippedFlowGroups = {}
  useFlowStore().rightTab = 'flow'
  announceLoading.value = false
  announceOpenLoading.value = false
  notesSaving.value = false
  listFilter.value = 'all'
  terminalPrefs.value = {
    theme: 'project-dark',
    fontSize: 13,
    cursorBlink: true,
    pastePolicy: 'confirm',
    autoCollapseOnExit: false,
    scrollback: 5000,
  }
  furnaceSurface.value = 'tui'
}

export function initSessionDetail({ route, router }) {
  setWorkbenchContext({ route, router })
  resetSessionState()
  // 出现待处理闸门时自动展开底栏，避免漏操作
  _stopWatchers.push(
    watch(pendingGate, (g) => {
      if (g) useComposerStore().footerCollapsed = false
    }),
  )
  // 路由 / 侧栏驱动：activeId 变化即加载
  _stopWatchers.push(
    watch(activeId, (id, prev) => {
      if (id && id !== prev && (!detail.value || detail.value.session.id !== id)) {
        selectSession(id)
      }
    }),
  )
  // 流程轨锚定滚动
  _stopWatchers.push(
    watch(
      [flowAnchorNodeId, () => useFlowStore().rightTab, () => detail.value?.nodes?.length],
      () => {
        scrollFlowToAnchor()
      },
    ),
  )
}

export function disposeSessionDetail() {
  clearFlowScrollTimer()
  _stopWatchers.forEach((stop) => stop())
  _stopWatchers = []
}

export {
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
  terminalPrefs,
  furnaceSurface,
  listFilter,
  filteredSlashCmds,
  filteredAtMembers,
  filterOptions,
  startableMembers,
  conversationItems,
  bubbleList,
  pendingGate,
  sessionParamsList,
  sessionGroupCard,
  sessionGroupFolder,
  hashItems,
  filteredHashItems,
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
  offsiteActive,
  offsiteMode,
  activeOffsiteNode,
  flowEntries,
  flowHistorySplitIndex,
  flowAnchorNodeId,
  convMenu,
  readSenderText,
  readSenderTextRaw,
  replaceSenderText,
  appendSenderText,
  clearSender,
  copyComposerText,
  loadLists,
  loadDetail,
  selectSession,
  startChat,
  startDemoChat,
  togglePin,
  onConvChange,
  onConvMenu,
  openAnnouncementMd,
  openDocsHub,
  rebuildAnnouncement,
  saveSessionNotes,
  announceMdHint,
  adapterChoices,
  answerAdapterQuestion,
  syncSlashFromInput,
  syncAtFromInput,
  syncHashFromInput,
  onSenderChange,
  onComposerKeydown,
  toggleSlashPanel,
  closeComposerPanel,
  toggleAtPanel,
  toggleHashPanel,
  insertAtMember,
  insertHashItem,
  runSlash,
  onSenderSubmit,
  submitHuman,
  approveSessionStart,
  gate,
  goShortcuts,
  rename,
  doDelete,
  restartFromNode,
  toggleNodeExpand,
  formatIo,
  toggleSkippedFlowGroup,
  isSkippedFlowGroupExpanded,
  nodeHasAdapt,
  nodeHasRefine,
  isClonedNode,
  isFlowHistoryNode,
  flowClass,
  isCurrent,
  isCurrentOffsiteSegment,
  offsiteEntryLabel,
  offsiteInvokedLabel,
  reviewLabel,
  reviewAction,
  statusLabel,
  statusType,
  stepTypeLabel,
  nodeBypassed,
  formatTime,
  roleLabel,
  shortSender,
  messageText,
  formatSize,
  fileIcon,
}
