import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  formatBusinessIo,
  wholeOutputText,
  extractCallArgsFromSlash,
  isMentionAssistOnly,
  stepTypeLabel as sharedStepTypeLabel,
  MAX_PROJECT_PARAMS,
  FURNACE_DISPLAY_NAME,
} from '@acw/shared'
import { api } from '../../../api'
import { useComposerStore } from '../../../stores/composer.js'
import { useFlowStore } from '../../../stores/flow.js'
import {
  composerScopeKey,
  loadInputDraft,
  pushInputHistory,
  saveInputDraft,
  stepInputHistory,
} from '../../../composables/inputDraftHistory.js'
import { historyNavigationDelta, isHistoryNavigationKey } from '../../../composables/inputIntent.js'
import { acwConfirm } from '../../../composables/acwConfirm.js'
import {
  messageText,
  formatSize,
  fileIcon,
  adapterChoices,
} from './sessionMessageUtils.js'
import { sessionStatusLabel, sessionStatusType } from './sessionStatusUi.js'
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
  relativeSessionTime,
  sessionListParts,
} from './sessionListUi.js'
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
  previewHashValue,
  footerCollapsedHintForPendingGate,
} from './sessionContextUi.js'
import { stripTrailingHashTrigger, textToChatNode } from './sessionComposerInput.js'
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

const filterOptions = [
  { label: '全部', value: 'all' },
  { label: '进行中', value: 'active' },
  { label: '已归档', value: 'archived' },
]

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
    ElMessage.warning('输入框为空')
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
    ElMessage.success('已复制')
  } catch (e) {
    ElMessage.warning(e?.message || '复制失败')
  }
}

/** Element-Plus-X Conversations 菜单：必须同时有 key + command，否则 command 为 undefined 导致点击无响应 */
const convMenu = [
  { label: '置顶', key: 'pin', command: 'pin' },
  { label: '取消置顶', key: 'unpin', command: 'unpin' },
  { label: '重命名', key: 'rename', command: 'rename' },
  {
    label: '删除',
    key: 'delete',
    command: 'delete',
    divided: true,
    menuItemHoverStyle: {
      color: 'red',
      backgroundColor: 'rgba(255, 0, 0, 0.1)',
    },
  },
]

const filteredSessions = computed(() => {
  let list
  if (listFilter.value === 'all') list = sessions.value.slice()
  else if (listFilter.value === 'archived') {
    list = sessions.value.filter((s) => s.status === 'archived')
  } else {
    list = sessions.value.filter((s) => s.status !== 'archived')
  }
  // 先群模板、后成员；块内置顶优先，再按更新时间
  return list.sort((a, b) => {
    const am = a.adhoc ? 1 : 0
    const bm = b.adhoc ? 1 : 0
    if (am !== bm) return am - bm
    const pa = a.pinned ? 1 : 0
    const pb = b.pinned ? 1 : 0
    if (pb !== pa) return pb - pa
    return String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
  })
})

/** 会话历史两大块：群模板 / 成员（块内置顶+时间已在 filteredSessions 排好） */
const conversationItems = computed(() =>
  filteredSessions.value.map((s) => {
    const outcome = archiveOutcomeOf(s)
    const parts = sessionListParts(s)
    return {
      uniqueKey: s.id,
      label: parts.label,
      labelPrefix: parts.labelPrefix,
      groupAbbr: parts.groupAbbr,
      group: s.adhoc ? '成员' : '群模板',
      id: s.id,
      status: s.status,
      title: s.title,
      hoverTitle: parts.hoverTitle,
      pinned: !!s.pinned,
      archiveOutcome: outcome,
      adhoc: !!s.adhoc,
      timeLabel: ['archived'].includes(s.status) ? '' : relativeSessionTime(s.updated_at),
    }
  }),
)

function isArchiveMessage(m) {
  return isArchiveStatusMessage(m, messageText(m))
}

/** Element-Plus-X BubbleList — 大气气泡 + 发送人简称 */
const bubbleList = computed(() => {
  if (!detail.value?.messages) return []
  const messages = detail.value.messages
    .filter((m) => {
      if (m.type === 'gate' && m.content?.mode === 'archive_confirm') return false
      if (isArchiveMessage(m)) return false
      return true
    })
    .map((m) => {
      const isUser = m.role === 'user'
      const isSystem = m.role === 'system'
      const isGate = m.type === 'gate'
      const isArchive = isArchiveMessage(m)
      const full = roleLabel(m)
      const short = isArchive ? '系统' : shortSender(m, full)
      const atts = m.content?.attachments || []
      const kind = isUser
        ? 'user'
        : isArchive
          ? 'archive'
          : isSystem
            ? 'system'
            : isGate
              ? 'gate'
              : 'agent'
      return {
        id: m.id,
        content: messageText(m),
        attachments: atts,
        placement: isUser ? 'end' : 'start',
        /** 去掉组件自带外层壳，只保留我们自己的一层气泡 */
        noStyle: true,
        shape: 'round',
        maxWidth: '78%',
        avatarGap: 12,
        senderFull: full,
        senderShort: short,
        senderInitial: short.slice(0, 1),
        _kind: kind,
        _raw: m,
        _time: m.created_at || '',
      }
    })
  const terminals = (terminalBridge.terminalSessions?.value || []).map((terminal) => ({
    id: `terminal:${terminal.id}`,
    content: '',
    placement: 'start',
    noStyle: true,
    shape: 'round',
    maxWidth: '90%',
    avatarGap: 12,
    senderFull: terminal.label || '内嵌终端',
    senderShort: '终端',
    senderInitial: 'T',
    _kind: 'terminal',
    terminal,
    _time: terminal.startedAt || '',
  }))
  return [...messages, ...terminals].sort((a, b) => String(a._time).localeCompare(String(b._time)))
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
  const items = []
  const card = sessionGroupCard.value || ''
  items.push({
    key: '群聊',
    label: '群聊',
    name: '群聊名片',
    value: card,
    preview: previewHashValue(card),
    emptyHint: '开聊后写入群名片',
  })
  const folder = sessionGroupFolder.value || ''
  items.push({
    key: '文件夹',
    label: '文件夹',
    name: '工作文件夹',
    value: folder,
    preview: previewHashValue(folder),
    emptyHint: '未配置工作目录',
  })

  // 用户输入：空格/换行切成第 1…99 段
  const list = sessionParamsList.value.slice(0, MAX_PROJECT_PARAMS)
  const shown = Math.min(MAX_PROJECT_PARAMS, Math.max(list.length, 1))
  for (let n = 1; n <= shown; n++) {
    const text = list[n - 1] == null ? '' : String(list[n - 1])
    items.push({
      key: String(n),
      label: String(n),
      name: `输入·第${n}段`,
      value: text,
      preview: previewHashValue(text),
      emptyHint: n === 1 && !list.length ? '空格/换行分隔录入；最多 #99' : '空',
    })
  }

  // 节点输出：整段不切分
  const nodes = detail.value?.nodes || []
  let outIdx = 0
  for (const n of nodes) {
    const whole = wholeOutputText(n.output)
    if (!whole) continue
    outIdx += 1
    const title = n.title || `步骤 ${n.step_index + 1}`
    items.push({
      key: `出${outIdx}`,
      label: `出${outIdx}`,
      name: `输出·${title}`,
      value: whole,
      preview: previewHashValue(whole),
      emptyHint: '',
    })
  }

  return items
})

const filteredHashItems = computed(() => {
  const q = (useComposerStore().hashQuery || '').toLowerCase().trim().replace(/^#/, '')
  const list = hashItems.value
  const filtered = !q
    ? list
    : list.filter(
        (h) =>
          h.key.toLowerCase().includes(q) ||
          h.label.toLowerCase().includes(q) ||
          h.name.toLowerCase().includes(q) ||
          String(h.value || '')
            .toLowerCase()
            .includes(q),
      )
  const n = Number(q)
  if (Number.isInteger(n) && n >= 1 && n <= MAX_PROJECT_PARAMS) {
    if (!filtered.some((h) => h.key === String(n))) {
      const text = sessionParamsList.value[n - 1] == null ? '' : String(sessionParamsList.value[n - 1])
      return [
        ...filtered,
        {
          key: String(n),
          label: String(n),
          name: `输入·第${n}段`,
          value: text,
          preview: previewHashValue(text),
          emptyHint: '尚未写入',
        },
      ]
    }
  }
  return filtered
})

/** 折叠时底栏提示文案 */
const footerCollapsedHint = computed(() =>
  footerCollapsedHintForPendingGate(pendingGate.value),
)

/** 运行时：当前需要人介入（闸门 / 等人状态）→ 标红突出 */
const needsHuman = computed(() => {
  if (!detail.value) return false
  if (detail.value.session.status === 'archived') return false
  if (detail.value.session.status === 'waiting_human') return true
  if (detail.value.session.status === 'interrupted') return true
  return !!pendingGate.value
})

const archiveOutcomeTag = computed(() => {
  if (!detail.value?.session) return null
  const o = archiveOutcomeOf(detail.value.session, detail.value.nodes)
  if (!o) return null
  if (o === 'failed') return { label: '失败', type: 'danger', ok: false }
  return { label: '成功', type: 'success', ok: true }
})

/** 群报告：启动说明 */
const announceKickoff = computed(() => {
  const k = sessionCtx()?.kickoff
  const t = k && typeof k === 'object' ? String(k.text || '').trim() : ''
  return t
})

/** 群报告：用户参与附言列表 */
const announceUserNotes = computed(() => {
  const list = sessionCtx()?.userNotes
  if (!Array.isArray(list)) return []
  return list
    .filter((u) => u && String(u.text || '').trim())
    .map((u) => ({
      actionLabel: u.actionLabel || u.action || '附言',
      nodeTitle: u.nodeTitle || '',
      text: String(u.text).trim(),
    }))
})

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
    if (groups.value[0]) startTarget.value = `g:${groups.value[0].id}`
    else if (startableMembers.value[0]) startTarget.value = `m:${startableMembers.value[0].id}`
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
  if (prev && prev !== id) {
    saveInputDraft(composerScopeKey(prev), readSenderTextRaw())
  }
  composerHistIndex = -1
  activeId.value = id
  terminalBridge.resetTerminals?.()
  _router.replace(`/workbench/${id}`)
  useFlowStore().rightTab = 'flow' // 默认展示流程 Tab
  useFlowStore().expandedSkippedFlowGroups = {}
  terminalBridge.bindWs?.(id)
  await Promise.all([loadDetail(id), terminalBridge.loadTerminals?.(id)])
  terminalBridge.revealFurnaceTui?.()
  const savedDraft = loadInputDraft(composerScopeKey(id))
  if (savedDraft) await replaceSenderText(savedDraft)
}

/** 群报告 MD 路径提示（相对 dataRoot） */
const announceMdHint = computed(() => {
  const p =
    detail.value?.announcement?.path ||
    detail.value?.session?.context?.announcementPath ||
    (activeId.value
      ? `journals/sessions/${activeId.value}/ANNOUNCEMENT.md`
      : '')
  return p ? `打开 ${p}` : '打开群报告 Markdown'
})

/** 用系统默认程序打开 ANNOUNCEMENT.md */
async function openAnnouncementMd() {
  if (!activeId.value) return
  announceOpenLoading.value = true
  try {
    const r = await api.sessions.openAnnouncement(activeId.value)
    if (r?.path && detail.value) {
      detail.value.announcement = {
        ...(detail.value.announcement || {}),
        path: r.path,
      }
    }
    ElMessage.success(r?.absolutePath ? `已打开 ${r.absolutePath}` : '已打开群报告 MD')
  } catch (e) {
    ElMessage.warning(e.message || '打开失败')
  } finally {
    announceOpenLoading.value = false
  }
}

/** 文档中心（4.0）：新开标签打开并定位到当前会话公告，替代旧的裸 MD 打开 */
function openDocsHub({ newTab = false, file = 'ANNOUNCEMENT.md' } = {}) {
  if (!activeId.value) return
  const query = {
    session: activeId.value,
    file: file || 'ANNOUNCEMENT.md',
  }
  if (newTab || (!window.__ACW_DESKTOP_API__ && !window.__ACW_DESKTOP_ENV__)) {
    const qs = new URLSearchParams(query).toString()
    window.open(`/docs?${qs}`, '_blank', 'noopener')
    return
  }
  useFlowStore().clearDocsUnread()
  if (_router) {
    _router.push({ path: '/docs', query })
  } else {
    const qs = new URLSearchParams(query).toString()
    window.location.assign(`/docs?${qs}`)
  }
}

/** 刷新群报告台账文件（后台 MD）；界面始终跟节点 / # 参数走 */
async function rebuildAnnouncement() {
  if (!activeId.value) return
  announceLoading.value = true
  try {
    await api.sessions.refreshAnnouncement(activeId.value, { modes: ['io'] })
    await loadDetail(activeId.value)
    ElMessage.success('群报告已刷新')
  } catch (e) {
    ElMessage.error(e.message || '刷新失败')
  } finally {
    announceLoading.value = false
  }
}

async function saveSessionNotes() {
  if (!activeId.value) return
  notesSaving.value = true
  try {
    const r = await api.sessions.saveNotes(activeId.value, sessionNotesDraft.value)
    sessionNotesDraft.value = r.notes ?? sessionNotesDraft.value
    if (detail.value?.session) {
      detail.value.session.context = {
        ...(detail.value.session.context || {}),
        notes: sessionNotesDraft.value,
      }
    }
    ElMessage.success('备注已保存')
  } catch (e) {
    ElMessage.error(e.message || '保存备注失败')
  } finally {
    notesSaving.value = false
  }
}

async function answerAdapterQuestion(m, choice, action = 'adapter_answer') {
  if (gating.value || !activeId.value) return
  gating.value = true
  try {
    const text = readSenderText()
    await api.sessions.gate(activeId.value, {
      action,
      text: text || undefined,
      choice: choice || undefined,
      questionId: m?.content?.questionId,
      nodeInstanceId: m?.node_instance_id || undefined,
      idempotencyKey: nextIdempotencyKey('adapter_answer', m?.content?.questionId),
    })
    clearSender()
    await loadDetail(activeId.value)
    ElMessage.success('已回答工具提问')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    gating.value = false
  }
}

function onConvChange(item) {
  const id = item?.uniqueKey || item?.id
  if (id) selectSession(id)
}

function normalizeMenuCommand(command) {
  if (command == null) return ''
  if (typeof command === 'string' || typeof command === 'number') return String(command)
  if (typeof command === 'object') {
    return String(command.command ?? command.key ?? command.value ?? '')
  }
  return String(command)
}

async function togglePin(id, pinned) {
  if (!id) return
  try {
    const s = await api.sessions.pin(id, pinned)
    sessions.value = await api.sessions.list()
    if (detail.value?.session?.id === id) {
      detail.value = {
        ...detail.value,
        session: { ...detail.value.session, pinned: !!s?.pinned },
      }
    }
    ElMessage.success(pinned ? '已置顶' : '已取消置顶')
  } catch (e) {
    ElMessage.error(e.message || '操作失败')
  }
}

async function onConvMenu(command, item) {
  const cmd = normalizeMenuCommand(command)
  const id = item?.uniqueKey || item?.id || item?.key
  if (!id) {
    ElMessage.warning('无法识别该会话')
    return
  }
  if (cmd === 'pin' || cmd === '置顶') {
    await togglePin(id, true)
    return
  }
  if (cmd === 'unpin' || cmd === '取消置顶') {
    await togglePin(id, false)
    return
  }
  if (cmd === 'delete' || cmd === '删除') {
    await doDelete(id)
    return
  }
  if (cmd === 'rename' || cmd === '重命名') {
    try {
      const current =
        sessions.value.find((s) => s.id === id)?.title ||
        (detail.value?.session?.id === id ? detail.value.session.title : '') ||
        ''
      const { value } = await ElMessageBox.prompt('聊天名称', '重命名', {
        inputValue: current,
        confirmButtonText: '确定',
        cancelButtonText: '取消',
      })
      if (value?.trim()) {
        await api.sessions.rename(id, value.trim())
        if (activeId.value === id) editTitle.value = value.trim()
        sessions.value = await api.sessions.list()
        if (detail.value?.session?.id === id) await loadDetail(id)
        ElMessage.success('已重命名')
      }
    } catch {
      /* 取消 */
    }
  }
}

async function startChat(opts = {}) {
  const quiet = !!(opts && typeof opts === 'object' && !(opts instanceof Event) && opts.quiet)
  const raw = String(startTarget.value || '')
  const kind = raw.slice(0, 2)
  const id = raw.slice(2)
  if (!id || (kind !== 'g:' && kind !== 'm:')) {
    ElMessage.warning('请选择群模板或成员')
    return
  }
  if (startingChat.value) return
  startingChat.value = true
  try {
    const s =
      kind === 'm:'
        ? await api.members.startSession(id, {})
        : await api.groups.startSession(id, {})
    await loadLists()
    await selectSession(s.id)
    if (!quiet) {
      ElMessage.success(
        kind === 'm:'
          ? s.reused
            ? '已回到与该成员的会话'
            : '已与成员开聊'
          : '已开聊',
      )
    }
    return s
  } catch (e) {
    // 业务异常不 toast Error；无 message 时仍给反馈，避免像「点了没反应」
    ElMessage.warning(e?.message || '开聊失败，请稍后重试')
  } finally {
    startingChat.value = false
  }
}

/** 欢迎页：一键开聊演示流 */
async function startDemoChat() {
  if (startingChat.value) return
  let demo = groups.value.find((g) => g.title === '演示流')
  if (!demo) {
    try {
      await loadLists()
    } catch (e) {
      ElMessage.warning(e?.message || '加载群模板失败，请稍后重试')
      return
    }
    demo = groups.value.find((g) => g.title === '演示流')
  }
  if (!demo) {
    ElMessage.warning('未找到「演示流」。请到设置打开「显示演示示例」。')
    return
  }
  startTarget.value = `g:${demo.id}`
  await startChat()
}

function syncSlashFromInput() {
  const text = readSenderText()
  // 仅当输入以 / 开头时当作指令模式（整段像 /editor）
  if (text.startsWith('/')) {
    useComposerStore().slashOpen = true
    useComposerStore().atOpen = false
    useComposerStore().hashOpen = false
    const body = text.slice(1)
    useComposerStore().slashQuery = body.split(/\s/)[0] || ''
    useComposerStore().slashIndex = 0
  } else {
    // 删掉 /、清空输入、或改成普通消息：同步收起快捷指令气泡
    useComposerStore().slashOpen = false
    useComposerStore().slashQuery = ''
  }
}

/** 光标在末尾的 @query 时弹出成员面板 */
function syncAtFromInput() {
  const text = readSenderText()
  if (text.startsWith('/')) {
    useComposerStore().atOpen = false
    return
  }
  // 最后一个未完成的 @片段（@ 后不含空格）
  const m = text.match(/(^|[\s])@([^\s@]*)$/)
  if (m) {
    useComposerStore().atOpen = true
    useComposerStore().slashOpen = false
    useComposerStore().hashOpen = false
    useComposerStore().atQuery = m[2] || ''
    useComposerStore().atIndex = 0
  } else if (!text.endsWith('@')) {
    // 已选完 @名字 或无 @：关面板
    useComposerStore().atOpen = false
    useComposerStore().atQuery = ''
  }
}

/** 光标在末尾的 #query 时弹出文本快捷面板 */
function syncHashFromInput() {
  if (Date.now() < hashInsertLockUntil) return
  const text = readSenderTextRaw().replace(/\s+$/u, '')
  if (text.startsWith('/')) {
    useComposerStore().hashOpen = false
    return
  }
  // 末尾 #片段：允许无前导空格（如 build#）
  const m = text.match(/(?:^|[\s])#([^\s#]*)$/u)
  if (m) {
    useComposerStore().hashOpen = true
    useComposerStore().slashOpen = false
    useComposerStore().atOpen = false
    useComposerStore().hashQuery = m[1] || ''
    useComposerStore().hashIndex = 0
  } else if (!/#([^\s#]*)$/u.test(text)) {
    useComposerStore().hashOpen = false
    useComposerStore().hashQuery = ''
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

  // # 面板：群聊 / 文件夹 / #1…
  if (useComposerStore().hashOpen) {
    const list = filteredHashItems.value
    if (e.key === 'Escape') {
      e.preventDefault()
      useComposerStore().hashOpen = false
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!list.length) return
      useComposerStore().hashIndex = (useComposerStore().hashIndex + 1) % list.length
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!list.length) return
      useComposerStore().hashIndex = (useComposerStore().hashIndex - 1 + list.length) % list.length
      return
    }
    if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
      if (!list.length) return
      e.preventDefault()
      e.stopPropagation()
      insertHashItem(list[useComposerStore().hashIndex] || list[0])
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
  if (useComposerStore().atOpen) {
    const members = filteredAtMembers.value
    const total = members.length
    if (e.key === 'Escape') {
      e.preventDefault()
      useComposerStore().atOpen = false
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!total) return
      useComposerStore().atIndex = (useComposerStore().atIndex + 1) % total
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!total) return
      useComposerStore().atIndex = (useComposerStore().atIndex - 1 + total) % total
      return
    }
    if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
      if (!total) return
      e.preventDefault()
      e.stopPropagation()
      insertAtMember(members[useComposerStore().atIndex] || members[0])
      return
    }
  }

  if (!useComposerStore().slashOpen) {
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
  if (e.key === 'Escape') {
    e.preventDefault()
    useComposerStore().slashOpen = false
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!list.length) return
    useComposerStore().slashIndex = (useComposerStore().slashIndex + 1) % list.length
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (!list.length) return
    useComposerStore().slashIndex = (useComposerStore().slashIndex - 1 + list.length) % list.length
    return
  }
  if (e.key === 'Enter' && !e.shiftKey && list.length) {
    // 指令模式：Enter 执行选中项，不发消息
    const t = readSenderText()
    if (t.startsWith('/')) {
      e.preventDefault()
      e.stopPropagation()
      runSlash(list[useComposerStore().slashIndex] || list[0])
    }
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
    ElMessage.warning(`${h.name || h.label || '该项'}暂无内容可插入`)
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
  return !!useFlowStore().expandedSkippedFlowGroups[entry.key]
}

function toggleSkippedFlowGroup(entry) {
  useFlowStore().expandedSkippedFlowGroups = {
    ...useFlowStore().expandedSkippedFlowGroups,
    [entry.key]: !isSkippedFlowGroupExpanded(entry),
  }
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
    ElMessage.warning('临时协助没有「重新开始」；请点右侧正常节点「从这里继续」')
    return
  }
  if (n.step_type === 'archive') {
    ElMessage.warning('归档节点没有「重新开始」；请点右侧正常节点')
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
    const suffix = wasArchived
      ? ' · 已恢复'
      : wasOffsite || r.offsiteArchived
        ? ' · 临时协助本段已归档'
        : ''
    ElMessage.success(
      r.forwardJump
        ? `已跳到「${title}」继续${suffix}`
        : `已从「${title}」继续${suffix}`,
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

async function runSlash(cmd) {
  if (!cmd) return
  try {
    let url
    if (cmd.kind === 'url' && cmd.promptForUrl) {
      const { value } = await ElMessageBox.prompt(cmd.description || '打开网址', cmd.name, {
        inputValue: cmd.url || 'https://',
      })
      url = value
    }
    const args = extractCallArgsFromSlash(readSenderTextRaw(), cmd.slash)
    const r = await api.slashCommands.run(cmd.id, {
      sessionId: activeId.value || undefined,
      url,
      args,
    })
    useComposerStore().slashOpen = false
    useComposerStore().slashQuery = ''
    if (r.kind === 'url' && r.url) {
      window.open(r.url, '_blank', 'noopener')
      clearSender()
    } else if (r.kind === 'agent') {
      // 熔炉 / 成员 Agent：写入提示语到输入框，用户可补全后发送
      await replaceSenderText(
        r.insertText || `请【${r.memberName || FURNACE_DISPLAY_NAME}】协助处理：`,
      )
    } else {
      clearSender()
    }
    ElMessage.success(r.message || `已执行 /${cmd.slash}`)
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function onSenderSubmit() {
  if (sending.value || uploading.value) return
  const text = readSenderText()
  const atts = [...pendingFiles.value]

  // /指令 提交时执行而非发消息
  if (text.startsWith('/')) {
    const token = text.slice(1).trim().split(/\s+/)[0] || ''
    const cmd =
      slashCommands.value.find((c) => c.enabled !== false && c.slash === token) ||
      filteredSlashCmds.value[useComposerStore().slashIndex]
    if (cmd) {
      await runSlash(cmd)
      return
    }
    ElMessage.warning(`未找到指令 /${token}，可在 设置 → 斜杠 / 快捷键 中配置`)
    return
  }

  // 人工输入 / 缺参补齐闸门：Enter = 提交闸门（纯 @成员协助除外，不推进流程）
  const g = pendingGate.value
  const mentionAssist =
    !!text &&
    isMentionAssistOnly(
      text,
      (members.value || []).map((m) => ({
        display_name: m.display_name,
        name: m.name,
      })),
    )
  if (
    (g?.content?.mode === 'human_input' || g?.content?.mode === 'need_params') &&
    !mentionAssist
  ) {
    await submitHuman(g)
    return
  }
  // 启动闸门 / 审核闸门：Enter 只发消息，保持 pending，不默认通过或拒绝
  // 人工闸门下纯 @：走发消息协助，不当项目参数提交

  if (!text && !atts.length) return

  pushInputHistory(composerScopeKey(activeId.value), text)
  composerHistIndex = -1
  saveInputDraft(composerScopeKey(activeId.value), '')

  if (!activeId.value) {
    ElMessage.warning('请先选择会话')
    return
  }
  sending.value = true
  try {
    const r = await api.sessions.message(activeId.value, text, atts)
    clearSender()
    pendingFiles.value = []
    if (r.mentionPending) {
      ElMessage.success(
        r.offsiteMode === 'planned' ? '临时协助 · 已记入挂起节点' : '已进入临时协助',
      )
      if (r.mainGateWaiting) {
        ElMessage.info('主流程仍停在当前确认，临时协助不替代提交')
      }
    }
    if (r.newSession && r.session) {
      await loadLists()
      await selectSession(r.session.id)
      ElMessage.success('已创建新任务')
    } else {
      await loadDetail(activeId.value)
      sessions.value = await api.sessions.list()
    }
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    sending.value = false
  }
}

function nextIdempotencyKey(action, nodeInstanceId) {
  return `gate_${action || 'x'}_${nodeInstanceId || 'none'}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

async function submitHuman(m) {
  if (gating.value) return
  const text = readSenderText()
  // 闸门「提交」按钮：纯 @ 协助不当参数
  if (
    text &&
    isMentionAssistOnly(
      text,
      (members.value || []).map((x) => ({
        display_name: x.display_name,
        name: x.name,
      })),
    )
  ) {
    await onSenderSubmit()
    return
  }
  gating.value = true
  try {
    await api.sessions.gate(activeId.value, {
      action: 'submit',
      text,
      nodeInstanceId: m.node_instance_id,
      idempotencyKey: nextIdempotencyKey('submit', m.node_instance_id),
    })
    clearSender()
    await loadDetail(activeId.value)
    sessions.value = await api.sessions.list()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    gating.value = false
  }
}

/** 开聊启动闸门：通过（可带说明/参数）后才开始跑流程 */
async function approveSessionStart(m) {
  if (gating.value) return
  gating.value = true
  try {
    const text = readSenderText()
    await api.sessions.gate(activeId.value, {
      action: 'approve_start',
      text,
      nodeInstanceId: m?.node_instance_id || undefined,
      idempotencyKey: nextIdempotencyKey('approve_start', m?.node_instance_id),
    })
    clearSender()
    await loadDetail(activeId.value)
    sessions.value = await api.sessions.list()
    ElMessage.success('已通过，开始执行')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    gating.value = false
  }
}

async function gate(m, action) {
  if (gating.value) return
  gating.value = true
  try {
    // 同意/拒绝/归档等：附言取自底部唯一输入框（X07）
    const text = readSenderText()
    await api.sessions.gate(activeId.value, {
      action,
      text: text || undefined,
      nodeInstanceId: m?.node_instance_id || undefined,
      idempotencyKey: nextIdempotencyKey(action, m?.node_instance_id),
    })
    clearSender()
    await loadDetail(activeId.value)
    sessions.value = await api.sessions.list()
    if (action === 'approve_start') ElMessage.success('已通过，开始执行')
    else if (action === 'cancel_start') ElMessage.info('已取消，任务关闭')
    else if (action === 'resume_interrupted') ElMessage.success('已继续')
    else if (action === 'discard_interrupted' || action === 'archive_interrupted')
      ElMessage.info('已放弃；进程请到设置里释放')
    else if (action === 'approve' || action === 'admin_approve')
      ElMessage.success(text?.trim() ? '已同意并记录附言' : '已同意')
    else if (action === 'reject' || action === 'admin_reject')
      ElMessage.info(text?.trim() ? '已拒绝并记录附言' : '已拒绝')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    gating.value = false
  }
}

async function rename() {
  if (!activeId.value || !editTitle.value.trim()) return
  try {
    await api.sessions.rename(activeId.value, editTitle.value.trim())
    sessions.value = await api.sessions.list()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

/** 只接受字符串会话 id。Vue 把 @click="doDelete" 的 MouseEvent 当第一参时必须忽略，否则会 DELETE /sessions/[object PointerEvent] */
function resolveSessionId(targetId) {
  return typeof targetId === 'string' && targetId ? targetId : activeId.value
}

/** @param {string} [targetId] 侧栏菜单可传指定会话 id；顶栏按钮不传则删当前 */
async function doDelete(targetId) {
  const id = resolveSessionId(targetId)
  if (!id) {
    ElMessage.warning('没有可删除的会话')
    return
  }
  const ok = await acwConfirm('session.delete', {
    title: '删除',
    message: '确认删除该聊天？不可恢复',
    confirmButtonText: '删除',
    type: 'warning',
  })
  if (!ok) return
  const wasActive = activeId.value === id
  try {
    await api.sessions.remove(id)
    await loadLists()
    if (wasActive || activeId.value === id) {
      detail.value = null
      terminalBridge.resetTerminals?.()
      terminalBridge.closeWs?.()
      activeId.value = ''
      _router.replace('/workbench')
    }
    ElMessage.success('已删除')
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}

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
