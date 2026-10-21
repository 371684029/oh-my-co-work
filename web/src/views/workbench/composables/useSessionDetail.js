import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import {
  formatBusinessIo,
  wholeOutputText,
  stepTypeLabel as sharedStepTypeLabel,
  MAX_PROJECT_PARAMS,
} from '@acw/shared'
import { api } from '../../../api'
import { useComposerStore } from '../../../stores/composer.js'
import { useFlowStore } from '../../../stores/flow.js'
import {
  composerScopeKey,
  loadInputDraft,
  saveInputDraft,
  stepInputHistory,
} from '../../../composables/inputDraftHistory.js'
import { historyNavigationDelta, isHistoryNavigationKey } from '../../../composables/inputIntent.js'
import { handleComposerPickerListKeydown } from './sessionComposerKeydownUi.js'
import { createSessionConvActions } from './sessionConvActions.js'
import { createSessionStartChatActions } from './sessionStartChatActions.js'
import { createSessionNotesActions } from './sessionNotesActions.js'
import { createSessionAnnounceActions } from './sessionAnnounceActions.js'
import { createSessionDeleteActions } from './sessionDeleteActions.js'
import { createSessionRenameActions } from './sessionRenameActions.js'
import { createSessionSlashActions } from './sessionSlashActions.js'
import {
  restartArchiveBlockedMessage,
  restartFromNodeSuccessMessage,
  restartOffsiteBlockedMessage,
} from './sessionFlowRestartUi.js'
import {
  announceMdHintLabel,
  composerCopyFailedMessage,
  composerCopySuccessMessage,
  composerEmptyMessage,
  hashItemEmptyInsertMessage,
} from './sessionWorkbenchFeedbackUi.js'
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
import { formatSessionTime, formatSessionIo } from './sessionFormatUtils.js'
import {
  buildFlowEntries,
  computeFlowHistorySplitIndex,
  isClonedNode,
  isCurrentStepNode,
  isFlowHistoryNode as isFlowHistoryNodeAt,
  nodeHasAdapt,
  nodeHasRefine,
  pickFlowAnchorNodeId,
  flowNodeClass,
} from './sessionFlowUi.js'
import {
  archiveOutcomeOf,
  buildConversationItems,
  CONVERSATION_MENU,
} from './sessionListUi.js'
import {
  mapMessageToBubbleItem,
  mapTerminalToBubbleItem,
  mergeBubbleRowsByTime,
  shouldHideMessageFromBubbleList,
} from './sessionBubbleListUi.js'
import { mapAnnounceProgressNode } from './sessionAnnounceUi.js'
import {
  computeOffsiteActive,
  findActiveOffsiteNode,
  computeOffsiteMode,
  isCurrentOffsiteSegment as isCurrentOffsiteSegmentNode,
  offsiteEntryLabel as offsiteEntryLabelForNode,
  offsiteInvokedLabel as offsiteInvokedLabelForNode,
} from './sessionOffsiteUi.js'
import { reviewAction, reviewLabel } from './sessionReviewUi.js'
import { isPendingGateMessage } from './sessionGateUi.js'
import { findPendingGateMessage } from './sessionPendingGate.js'
import { isArchiveStatusMessage } from './sessionBubbleUi.js'
import {
  parseSessionContext,
  extractSessionParamsList,
  sessionGroupCardFromContext,
  sessionGroupFolderFromContext,
  footerCollapsedHintForPendingGate,
} from './sessionContextUi.js'
import { buildHashComposerItems, filterHashComposerItems } from './sessionHashUi.js'
import {
  buildDocsHubQuery,
  docsHubOpenUsesNewTab,
  formatDocsHubSearchParams,
  resolveAnnounceMdRelativePath,
} from './sessionDocsNavUi.js'
import { createSessionGateActions } from './sessionGateActions.js'
import {
  pickDefaultStartTarget,
  shouldSaveComposerDraftOnSessionSwitch,
  workbenchSessionRoute,
} from './sessionLoadListsUi.js'
import {
  isSkippedFlowGroupExpanded as isSkippedFlowGroupExpandedUi,
  nextSkippedFlowGroupExpansion,
} from './sessionFlowNavUi.js'
import { nextGateIdempotencyKey } from './sessionGateIdempotency.js'
import {
  computeNeedsHuman,
  announceKickoffFromContext,
  announceUserNotesFromContext,
} from './sessionAttentionUi.js'
import { stripTrailingHashTrigger, textToChatNode } from './sessionComposerInput.js'
import {
  applyComposerPanelPatch,
  atPanelStateFromText,
  hashPanelStateFromText,
  slashPanelStateFromText,
} from './sessionComposerSync.js'
import {
  composerFooterHintForGate,
  composerPlaceholderForGate,
  composerToolbarHintForGate,
  showComposerHintIForGate,
} from './sessionComposerUi.js'
import { roleLabel as roleLabelForMessage, shortSender as shortSenderForMessage } from './sessionMessageUi.js'


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
let flowScrollTimer = 0

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
let composerDraftTimer = 0
/** 刚用 # 快捷覆写输入框后，短暂忽略 sync，避免面板闪回 */
let hashInsertLockUntil = 0
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

function readSenderText() {
  return readSenderTextRaw().trim()
}

/** 读输入框原文 */
function readSenderTextRaw() {
  const inst = senderRef.value
  if (!inst) return ''
  try {
    if (typeof inst.getModelValue === 'function') {
      return String(inst.getModelValue()?.text || '')
    }
    const sender = typeof inst.getSender === 'function' ? inst.getSender() : null
    if (sender?.getText) return String(sender.getText() || '')
  } catch {
    /* ignore */
  }
  return ''
}

/**
 * 整框覆写输入内容。
 * 注意：组件 setText 是光标插入；clear() 又是未 await 的 async reset，
 * 二者组合会丢字。正确做法是直接 await sender.reset({ chatNode }).
 */
async function replaceSenderText(text) {
  const inst = senderRef.value
  if (!inst) return
  const next = text == null ? '' : String(text)
  hashInsertLockUntil = Date.now() + 300
  try {
    const sender = typeof inst.getSender === 'function' ? inst.getSender() : null
    if (sender && typeof sender.reset === 'function') {
      await sender.reset({
        clearHistory: true,
        chatNode: textToChatNode(next),
      })
      return
    }
  } catch {
    /* ignore */
  }
  // 极端降级：仍尽量写进去
  try {
    if (typeof inst.clear === 'function') inst.clear()
    await nextTick()
    await new Promise((r) => setTimeout(r, 30))
    if (next) inst.setText?.(next)
  } catch {
    /* ignore */
  }
}

/** 仅在光标处追加（真正 insert） */
function appendSenderText(fragment) {
  const s = fragment == null ? '' : String(fragment)
  if (!s) return
  try {
    senderRef.value?.setText?.(s)
  } catch {
    /* ignore */
  }
}

function clearSender() {
  const inst = senderRef.value
  if (!inst) return
  try {
    if (typeof inst.clear === 'function') inst.clear()
  } catch {
    /* ignore */
  }
}

/** 一键复制输入框正文 */
async function copyComposerText() {
  const text = readSenderText()
  if (!text) {
    ElMessage.warning(composerEmptyMessage())
    return
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    ElMessage.success(composerCopySuccessMessage())
  } catch (e) {
    ElMessage.warning(composerCopyFailedMessage(e))
  }
}

const convMenu = CONVERSATION_MENU

/** 会话历史两大块：群模板 / 成员（块内置顶+时间已在 filteredSessions 排好） */
const conversationItems = computed(() =>
  buildConversationItems(sessions.value, listFilter.value),
)

function isArchiveMessage(m) {
  return isArchiveStatusMessage(m, messageText(m))
}

/** Element-Plus-X BubbleList — 大气气泡 + 发送人简称 */
const bubbleList = computed(() => {
  if (!detail.value?.messages) return []
  const bubbleDeps = { messageText, roleLabel, shortSender, isArchiveMessage }
  const messages = detail.value.messages
    .filter((m) => !shouldHideMessageFromBubbleList(m, isArchiveMessage))
    .map((m) => mapMessageToBubbleItem(m, bubbleDeps))
  const terminals = (terminalBridge.terminalSessions?.value || []).map(mapTerminalToBubbleItem)
  return mergeBubbleRowsByTime(messages, terminals)
})

const pendingGate = computed(() => {
  if (!detail.value) return null
  return findPendingGateMessage(
    detail.value.session,
    detail.value.messages,
    detail.value.nodes,
    isPendingGate,
  )
})

function sessionCtx() {
  return parseSessionContext(detail.value?.session)
}

/** 会话项目参数 #1 #2…（不含系统 #群聊） */
const sessionParamsList = computed(() =>
  extractSessionParamsList(sessionCtx(), MAX_PROJECT_PARAMS),
)

/** #群聊 → 整份群聊名片 */
const sessionGroupCard = computed(() => sessionGroupCardFromContext(sessionCtx()))

/** #文件夹 → 群聊工作目录 */
const sessionGroupFolder = computed(() => sessionGroupFolderFromContext(sessionCtx()))

/**
 * # 文本快捷候选（# 只是唤起键，选中后只插入正文）
 * label：面板展示用，不含 #
 */
const hashItems = computed(() => {
  if (!activeId.value) return []
  return buildHashComposerItems({
    groupCard: sessionGroupCard.value || '',
    groupFolder: sessionGroupFolder.value || '',
    paramsList: sessionParamsList.value,
    nodes: detail.value?.nodes || [],
    maxParams: MAX_PROJECT_PARAMS,
    wholeOutputText,
  })
})

const filteredHashItems = computed(() =>
  filterHashComposerItems(hashItems.value, useComposerStore().hashQuery, {
    maxParams: MAX_PROJECT_PARAMS,
    paramsList: sessionParamsList.value,
  }),
)

/** 折叠时底栏提示文案 */
const footerCollapsedHint = computed(() =>
  footerCollapsedHintForPendingGate(pendingGate.value),
)

/** 运行时：当前需要人介入（闸门 / 等人状态）→ 标红突出 */
const needsHuman = computed(() =>
  computeNeedsHuman(detail.value?.session, pendingGate.value),
)

const archiveOutcomeTag = computed(() => {
  if (!detail.value?.session) return null
  const o = archiveOutcomeOf(detail.value.session, detail.value.nodes)
  if (!o) return null
  if (o === 'failed') return { label: '失败', type: 'danger', ok: false }
  return { label: '成功', type: 'success', ok: true }
})

/** 群报告：启动说明 */
const announceKickoff = computed(() => announceKickoffFromContext(sessionCtx()))

/** 群报告：用户参与附言列表 */
const announceUserNotes = computed(() => announceUserNotesFromContext(sessionCtx()))

/**
 * 群报告：每个节点的实质入/出（含脚本额外产出、审核附言）
 * 不展示「开始/结束」空话
 */
const announceProgress = computed(() => {
  const nodes = detail.value?.nodes || []
  return nodes.map((n) =>
    mapAnnounceProgressNode(n, {
      formatIo: formatBusinessIo,
      statusLabel,
    }),
  )
})

/** 底部唯一输入框：有闸门时兼作附言/人工输入 */
const composerPlaceholder = computed(() => composerPlaceholderForGate(pendingGate.value))
const composerToolbarHint = computed(() => composerToolbarHintForGate(pendingGate.value))
const showComposerHintI = computed(() => showComposerHintIForGate(pendingGate.value))
const composerFooterHint = computed(() => composerFooterHintForGate(pendingGate.value))

const statusLabel = sessionStatusLabel

function nodeBypassed(n) {
  return !!(n?.output?.bypassed || n?.input?.bypassed)
}

function stepTypeLabel(t) {
  return sharedStepTypeLabel(t) || t
}

const statusType = sessionStatusType

const formatTime = formatSessionTime

function roleLabel(m) {
  return roleLabelForMessage(m, members.value)
}

function shortSender(m, fullName) {
  return shortSenderForMessage(m, fullName, members.value)
}

function isPendingGate(m) {
  if (!detail.value) return false
  return isPendingGateMessage(m, detail.value.nodes)
}

function isCurrent(n) {
  if (!detail.value) return false
  return isCurrentStepNode(n, detail.value.session)
}

const offsiteActive = computed(() =>
  computeOffsiteActive(detail.value?.session, detail.value?.nodes),
)

const activeOffsiteNode = computed(() =>
  findActiveOffsiteNode(detail.value?.nodes, detail.value?.session?.context),
)

/** planned | interrupt */
const offsiteMode = computed(() =>
  computeOffsiteMode(
    detail.value?.session?.context,
    activeOffsiteNode.value,
    offsiteActive.value,
  ),
)

function isCurrentOffsiteSegment(n) {
  return isCurrentOffsiteSegmentNode(n, activeOffsiteNode.value?.id)
}

function offsiteEntryLabel(n) {
  return offsiteEntryLabelForNode(n, {
    activeOffsiteNodeId: activeOffsiteNode.value?.id,
    mode: offsiteMode.value,
  })
}

function offsiteInvokedLabel(n) {
  return offsiteInvokedLabelForNode(n)
}

function flowClass(n) {
  return flowNodeClass(n, detail.value?.session)
}

function toggleNodeExpand(n) {
  useFlowStore().expandedNodeId = useFlowStore().expandedNodeId === n.id ? null : n.id
}

function formatIo(val, role = 'auto') {
  return formatSessionIo(val, role)
}

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
  composerHistIndex = -1
  activeId.value = id
  terminalBridge.resetTerminals?.()
  _router.replace(workbenchSessionRoute(id))
  useFlowStore().rightTab = 'flow' // 默认展示流程 Tab
  useFlowStore().expandedSkippedFlowGroups = {}
  terminalBridge.bindWs?.(id)
  await Promise.all([loadDetail(id), terminalBridge.loadTerminals?.(id)])
  terminalBridge.revealFurnaceTui?.()
  const savedDraft = loadInputDraft(composerScopeKey(id))
  if (savedDraft) await replaceSenderText(savedDraft)
}

/** 群报告 MD 路径提示（相对 dataRoot） */
const announceMdHint = computed(() =>
  announceMdHintLabel(resolveAnnounceMdRelativePath(detail.value, activeId.value)),
)

/** 文档中心（4.0）：新开标签打开并定位到当前会话公告，替代旧的裸 MD 打开 */
function openDocsHub({ newTab = false, file = 'ANNOUNCEMENT.md' } = {}) {
  const query = buildDocsHubQuery(activeId.value, file)
  if (!query) return
  const useNewTab = docsHubOpenUsesNewTab({
    newTab,
    hasDesktopApi: !!window.__ACW_DESKTOP_API__,
    hasDesktopEnv: !!window.__ACW_DESKTOP_ENV__,
  })
  if (useNewTab) {
    const qs = formatDocsHubSearchParams(query)
    window.open(`/docs?${qs}`, '_blank', 'noopener')
    return
  }
  useFlowStore().clearDocsUnread()
  if (_router) {
    _router.push({ path: '/docs', query })
  } else {
    const qs = formatDocsHubSearchParams(query)
    window.location.assign(`/docs?${qs}`)
  }
}

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

function syncSlashFromInput() {
  const text = readSenderText()
  const store = useComposerStore()
  const patch = slashPanelStateFromText(text)
  applyComposerPanelPatch(store, patch)
  if (patch.slashOpen) store.slashIndex = 0
}

/** 光标在末尾的 @query 时弹出成员面板 */
function syncAtFromInput() {
  const text = readSenderText()
  const store = useComposerStore()
  const patch = atPanelStateFromText(text)
  if (patch) {
    applyComposerPanelPatch(store, patch)
    if (patch.atOpen) store.atIndex = 0
  }
}

/** 光标在末尾的 #query 时弹出文本快捷面板 */
function syncHashFromInput() {
  const text = readSenderTextRaw().replace(/\s+$/u, '')
  const store = useComposerStore()
  const patch = hashPanelStateFromText(text, { locked: Date.now() < hashInsertLockUntil })
  if (patch) {
    applyComposerPanelPatch(store, patch)
    if (patch.hashOpen) store.hashIndex = 0
  }
}

function onSenderChange() {
  syncSlashFromInput()
  syncAtFromInput()
  syncHashFromInput()
  window.clearTimeout(composerDraftTimer)
  composerDraftTimer = window.setTimeout(() => {
    if (activeId.value) saveInputDraft(composerScopeKey(activeId.value), readSenderTextRaw())
  }, 400)
}

function onComposerKeydown(e) {
  const pickerOpen =
    useComposerStore().hashOpen || useComposerStore().atOpen || useComposerStore().slashOpen
  if (
    !pickerOpen &&
    isHistoryNavigationKey(e) &&
    activeId.value &&
    !readSenderTextRaw().trim()
  ) {
    const delta = historyNavigationDelta(e)
    const step = stepInputHistory(composerScopeKey(activeId.value), {
      index: composerHistIndex,
      delta,
    })
    if (step) {
      e.preventDefault()
      composerHistIndex = step.index
      void replaceSenderText(step.text)
      return
    }
  }

  const store = useComposerStore()

  // # 面板：群聊 / 文件夹 / #1…
  if (store.hashOpen) {
    const list = filteredHashItems.value
    if (
      handleComposerPickerListKeydown(e, {
        listLength: list.length,
        index: store.hashIndex,
        setIndex: (i) => {
          store.hashIndex = i
        },
        onPick: () => insertHashItem(list[store.hashIndex] || list[0]),
        onClose: () => {
          store.hashOpen = false
        },
      })
    ) {
      return
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      setTimeout(() => {
        syncHashFromInput()
        syncAtFromInput()
        syncSlashFromInput()
      }, 0)
    }
  }

  // @ 面板：仅成员协助（节点重跑已从面板移除，避免误触重头跑）
  if (store.atOpen) {
    const members = filteredAtMembers.value
    if (
      handleComposerPickerListKeydown(e, {
        listLength: members.length,
        index: store.atIndex,
        setIndex: (i) => {
          store.atIndex = i
        },
        onPick: () => insertAtMember(members[store.atIndex] || members[0]),
        onClose: () => {
          store.atOpen = false
        },
      })
    ) {
      return
    }
  }

  if (!store.slashOpen) {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      setTimeout(syncSlashFromInput, 0)
    }
    if (e.key === '@' && !e.ctrlKey && !e.metaKey) {
      setTimeout(syncAtFromInput, 0)
    }
    if (e.key === '#' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      setTimeout(syncHashFromInput, 0)
    }
    return
  }
  // Backspace/Delete 删掉 / 后立刻收起（不依赖 change 是否及时）
  if (e.key === 'Backspace' || e.key === 'Delete') {
    setTimeout(() => {
      syncSlashFromInput()
      syncAtFromInput()
      syncHashFromInput()
    }, 0)
  }
  const list = filteredSlashCmds.value
  if (
    handleComposerPickerListKeydown(e, {
      listLength: list.length,
      index: store.slashIndex,
      setIndex: (i) => {
        store.slashIndex = i
      },
      onPick: () => runSlash(list[store.slashIndex] || list[0]),
      onClose: () => {
        store.slashOpen = false
      },
      selectOnTab: false,
      enterRequiresSlashPrefix: true,
      readSenderText,
    })
  ) {
    return
  }
}

function toggleSlashPanel() {
  useComposerStore().atOpen = false
  useComposerStore().hashOpen = false
  useComposerStore().slashOpen = !useComposerStore().slashOpen
  if (useComposerStore().slashOpen) {
    useComposerStore().slashQuery = ''
    useComposerStore().slashIndex = 0
    // setText 是插入：只追加唤起符
    appendSenderText('/')
    syncSlashFromInput()
  }
}

/** 关闭 / @ # 浮层（与 Esc 一致，不关输入框里的唤起符） */
function closeComposerPanel(kind) {
  if (kind === 'slash') {
    useComposerStore().slashOpen = false
    useComposerStore().slashQuery = ''
    return
  }
  if (kind === 'at') {
    useComposerStore().atOpen = false
    useComposerStore().atQuery = ''
    return
  }
  if (kind === 'hash') {
    useComposerStore().hashOpen = false
    useComposerStore().hashQuery = ''
  }
}

function toggleAtPanel() {
  useComposerStore().slashOpen = false
  useComposerStore().hashOpen = false
  useComposerStore().atOpen = !useComposerStore().atOpen
  if (useComposerStore().atOpen) {
    useComposerStore().atQuery = ''
    useComposerStore().atIndex = 0
    const cur = readSenderText()
    appendSenderText(cur && !/\s$/.test(cur) ? ' @' : '@')
    syncAtFromInput()
  }
}

function toggleHashPanel() {
  useComposerStore().slashOpen = false
  useComposerStore().atOpen = false
  useComposerStore().hashOpen = !useComposerStore().hashOpen
  if (useComposerStore().hashOpen) {
    useComposerStore().hashQuery = ''
    useComposerStore().hashIndex = 0
    const cur = readSenderTextRaw()
    // 只追加唤起用 #（选中后 strip，不进正文）；勿把全文再 setText 一遍
    appendSenderText(cur && !/\s$/.test(cur) ? ' #' : '#')
    syncHashFromInput()
  }
}

/** 把当前 @query 替换为 @显示名  */
async function insertAtMember(m) {
  if (!m) return
  const name = m.display_name || m.name
  const text = readSenderText()
  const replaced = text.replace(/(^|[\s])@([^\s@]*)$/, `$1@${name} `)
  const next = replaced === text ? `${text}@${name} ` : replaced
  useComposerStore().atOpen = false
  useComposerStore().atQuery = ''
  await replaceSenderText(next)
}

/**
 * 选中项：去掉 # 唤起段，只插入正文（不含 #）。
 */
async function insertHashItem(h) {
  if (!h) return
  const insert = String(h.value || '').trim()
  const raw = readSenderTextRaw()
  let stripped = stripTrailingHashTrigger(raw)
  // 面板已开但 model 尚未带上 #：仍按触发态剥离
  if (useComposerStore().hashOpen && stripped === raw.replace(/[ \t]+$/u, '')) {
    stripped = stripTrailingHashTrigger(`${stripped}#`)
  }
  useComposerStore().hashOpen = false
  useComposerStore().hashQuery = ''
  if (!insert) {
    await replaceSenderText(stripped)
    ElMessage.warning(hashItemEmptyInsertMessage(h.name || h.label))
    return
  }
  await replaceSenderText(stripped ? `${stripped} ${insert}` : insert)
}

/**
 * 将相邻的「未跑过且已废弃」节点归为一段并默认收起。
 * 已执行节点（成功/失败/执行中/场外）和当前轨将要跑的节点保持展开。
 */
const flowEntries = computed(() =>
  buildFlowEntries(detail.value?.nodes, detail.value?.session),
)

function isSkippedFlowGroupExpanded(entry) {
  return isSkippedFlowGroupExpandedUi(useFlowStore(), entry)
}

function toggleSkippedFlowGroup(entry) {
  useFlowStore().expandedSkippedFlowGroups = nextSkippedFlowGroupExpansion(useFlowStore(), entry)
}

/** 当前世代起点：最近一次克隆批次，否则当前步及之后（仅用于历史样式，不再折叠） */
const flowHistorySplitIndex = computed(() =>
  computeFlowHistorySplitIndex(detail.value?.nodes, detail.value?.session),
)

function isFlowHistoryNode(n) {
  return isFlowHistoryNodeAt(n, detail.value?.nodes, flowHistorySplitIndex.value)
}

/** 流程轨应锚定滚动的节点：场外当前段 → 待确认 → 执行中 → 当前步 → 游标步 */
const flowAnchorNodeId = computed(() =>
  pickFlowAnchorNodeId(detail.value?.nodes, detail.value?.session, {
    activeOffsiteId: activeOffsiteNode.value?.id,
  }),
)

function scrollFlowToAnchor() {
  if (useFlowStore().rightTab !== 'flow') return
  const id = flowAnchorNodeId.value
  if (!id) return
  window.clearTimeout(flowScrollTimer)
  flowScrollTimer = window.setTimeout(async () => {
    await nextTick()
    const el = document.querySelector(
      `[data-flow-node-id="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id}"]`,
    )
    if (!el) return
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, 40)
}

/** 离开场外 / 从这里继续：往前跳直达；往回/再跑追加克隆；已归档亦可 */
async function restartFromNode(n) {
  if (!n || !activeId.value) return
  if (n.step_type === 'offsite') {
    ElMessage.warning(restartOffsiteBlockedMessage())
    return
  }
  if (n.step_type === 'archive') {
    ElMessage.warning(restartArchiveBlockedMessage())
    return
  }
  if (gating.value) return
  const wasOffsite = offsiteActive.value
  const wasArchived = detail.value?.session?.status === 'archived'
  gating.value = true
  try {
    const r = await api.sessions.restartFromNode(activeId.value, {
      nodeInstanceId: n.id,
      stepIndex: n.step_index,
    })
    useFlowStore().rightTab = 'flow'
    useComposerStore().footerCollapsed = false
    await loadDetail(activeId.value)
    sessions.value = await api.sessions.list()
    const focusId = r.nodeInstanceId || n.id
    useFlowStore().expandedNodeId = focusId
    scrollFlowToAnchor()
    const title = r.title || n.title || `步骤 ${n.step_index + 1}`
    ElMessage.success(
      restartFromNodeSuccessMessage({
        title,
        forwardJump: r.forwardJump,
        wasArchived,
        wasOffsite,
        offsiteArchived: r.offsiteArchived,
      }),
    )
  } catch (e) {
    // 业务异常由接口呈现，不再 toast Error
  } finally {
    gating.value = false
  }
}

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

const gateActionsRef = {}
const composerHistIndexRef = {
  get index() {
    return composerHistIndex
  },
  set index(v) {
    composerHistIndex = v
  },
}

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
  window.clearTimeout(flowScrollTimer)
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
