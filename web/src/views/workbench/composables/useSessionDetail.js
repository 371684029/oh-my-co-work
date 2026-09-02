import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  formatBusinessIo,
  wholeOutputText,
  abbrGroupTag,
  formatSessionAutoTitle,
  extractCallArgsFromSlash,
  isMentionAssistOnly,
  nodeStatusLabel,
  isDiscardedUnexecutedFlowNode,
  stepTypeLabel as sharedStepTypeLabel,
  MAX_PROJECT_PARAMS,
  FURNACE_DISPLAY_NAME,
} from '@acw/shared'
import { api } from '../../../api'

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
/** 刚用 # 快捷覆写输入框后，短暂忽略 sync，避免面板闪回 */
let hashInsertLockUntil = 0
const slashOpen = ref(false)
const slashQuery = ref('')
const slashIndex = ref(0)
const atOpen = ref(false)
const atQuery = ref('')
const atIndex = ref(0)
const hashOpen = ref(false)
const hashQuery = ref('')
const hashIndex = ref(0)
/** 待发送附件 */
const pendingFiles = ref([])
const uploading = ref(false)
/** 底部闸门+输入区折叠 */
const footerCollapsed = ref(false)

// ===== 流程轨 =====
const expandedNodeId = ref(null)
const expandedSkippedFlowGroups = ref({})
const rightTab = ref('flow')

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
const furnaceSurface = ref('chat')

// ===== 会话列表筛选 =====
const listFilter = ref('all')

const filteredSlashCmds = computed(() => {
  const q = (slashQuery.value || '').toLowerCase()
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
  const q = (atQuery.value || '').toLowerCase().trim()
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

/** 去掉末尾的 #快捷触发段（# / #xxx），可无前导空格 */
function stripTrailingHashTrigger(text) {
  let s = String(text || '')
  for (let i = 0; i < 6; i++) {
    const next = s.replace(/\s*#[^\s#]*$/u, '').replace(/[ \t]+$/u, '')
    if (next === s) break
    s = next
  }
  return s
}

/** 纯文本 → XSender chatNode（按行拆 Write） */
function textToChatNode(text) {
  const lines = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
  return lines.map((line) => [{ type: 'Write', text: line }])
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

/** 会话列表：#1 正文 + 群模板缩写标签；hover 气泡展示全文（前缀 + 群全称） */
function sessionListParts(s) {
  const ctx = s?.context && typeof s.context === 'object' ? s.context : {}
  const groupTitle = String(s.groupTitle || ctx.groupTitle || '').trim()
  const abbr = s.groupTitleAbbr || ctx.groupTitleAbbr || abbrGroupTag(groupTitle)

  // 手改过：整段标题，不用缩写标签
  if (ctx.titleAuto === false && s.title) {
    const full = String(s.title).trim()
    return {
      label: full,
      labelPrefix: full,
      groupAbbr: '',
      hoverTitle: full,
    }
  }

  const p1 = String(
    (Array.isArray(ctx.paramsList) && ctx.paramsList[0]) ||
      ctx.params?.['#1'] ||
      '',
  ).trim()
  const groupAbbr = abbr || ''
  const labelPrefix = p1
  const label =
    formatSessionAutoTitle({
      param1: p1,
      groupTitle,
      groupTitleAbbr: groupAbbr,
    }) ||
    s.title ||
    groupTitle ||
    '未命名'

  // 全文：优先「#1 · 群全称」，否则群全称 / 会话标题
  let hoverTitle = ''
  if (p1 && groupTitle) hoverTitle = `${p1} · ${groupTitle}`
  else if (groupTitle) hoverTitle = groupTitle
  else if (p1) hoverTitle = p1
  else hoverTitle = String(s.title || label || '').trim()

  return {
    label,
    labelPrefix,
    groupAbbr,
    hoverTitle,
  }
}

/** 相对时间：最小 h，最大 w；已归档返回空 */
function relativeTime(isoOrTs) {
  if (!isoOrTs) return ''
  const t = new Date(isoOrTs).getTime()
  if (!t || Number.isNaN(t)) return ''
  const diffMs = Date.now() - t
  if (diffMs < 0) return ''
  const mins = Math.floor(diffMs / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  if (hours < 1) return '刚刚'
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`
  return `${weeks}w`
}

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
      timeLabel: ['archived'].includes(s.status) ? '' : relativeTime(s.updated_at),
    }
  }),
)

function isArchiveMessage(m) {
  if (!m) return false
  if (m.type === 'status' && /归档/.test(messageText(m) || '')) return true
  const t = messageText(m) || ''
  return m.role === 'system' && /任务已.*归档|自动归档|已归档/.test(t)
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
  if (detail.value.session.status === 'archived') return null
  const msgs = [...detail.value.messages].reverse()
  const nodes = detail.value.nodes || []
  const curIdx = Number(detail.value.session.current_step_index)
  const curNode = Number.isFinite(curIdx)
    ? nodes.find((n) => Number(n.step_index) === curIdx)
    : null
  const adapterGate = msgs.find(
    (m) =>
      m.type === 'gate' &&
      m.content?.mode === 'adapter_question' &&
      m.content?.humanAction === 'pending' &&
      !m.content?.answered,
  )
  if (adapterGate) return adapterGate
  // 开聊启动闸门（无节点，等人点通过后再跑流程）
  const pendingStart = detail.value.session.context?.pendingStart
  if (pendingStart && detail.value.session.status !== 'interrupted') {
    const startGate = msgs.find(
      (m) => m.type === 'gate' && m.content?.mode === 'session_start',
    )
    if (startGate) return startGate
  }
  // R02：中断恢复闸门
  if (detail.value.session.status === 'interrupted') {
    const ig = msgs.find((m) => m.type === 'gate' && m.content?.mode === 'interrupted')
    if (ig) return ig
  }
  // 优先当前游标节点上的待确认闸门，避免旧「待确认」抢交互
  if (curNode?.status === 'waiting_human') {
    const curGate = msgs.find(
      (m) =>
        m.type === 'gate' &&
        m.node_instance_id === curNode.id &&
        isPendingGate(m),
    )
    if (curGate) return curGate
  }
  // 回退：只认仍 waiting_human、且不早于游标的闸门（已绕过节点的 gate 会被 isPendingGate 滤掉）
  return (
    msgs.find((m) => {
      if (m.type !== 'gate' || !isPendingGate(m)) return false
      const n = nodes.find((x) => x.id === m.node_instance_id)
      if (!n) return !m.node_instance_id
      if (!Number.isFinite(curIdx)) return true
      return Number(n.step_index) >= curIdx
    }) || null
  )
})

function sessionCtx() {
  const ctx = detail.value?.session?.context || detail.value?.session?.context_json
  if (typeof ctx === 'string') {
    try {
      return JSON.parse(ctx)
    } catch {
      return null
    }
  }
  return ctx || null
}

/** 会话项目参数 #1 #2…（不含系统 #群聊） */
const sessionParamsList = computed(() => {
  const c = sessionCtx()
  if (Array.isArray(c?.paramsList) && c.paramsList.length) {
    return c.paramsList.slice(0, MAX_PROJECT_PARAMS)
  }
  if (c?.params && typeof c.params === 'object') {
    const keys = Object.keys(c.params)
      .filter((k) => /^#\d+$/.test(k))
      .map((k) => Number(k.slice(1)))
      .filter((n) => n >= 1 && n <= MAX_PROJECT_PARAMS)
      .sort((a, b) => a - b)
    if (keys.length) return keys.map((n) => c.params[`#${n}`])
  }
  return []
})

/** #群聊 → 整份群聊名片 */
const sessionGroupCard = computed(() => {
  const c = sessionCtx()
  if (!c) return ''
  return c.groupCard || c.params?.['#群聊'] || c.params?.['群聊'] || ''
})

/** #文件夹 → 群聊工作目录 */
const sessionGroupFolder = computed(() => {
  const c = sessionCtx()
  if (!c) return ''
  return (
    c.groupFolder ||
    c.params?.['#文件夹'] ||
    c.params?.['文件夹'] ||
    c.primaryWorkFolder ||
    c.workFolders?.[0] ||
    ''
  )
})

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
  const q = (hashQuery.value || '').toLowerCase().trim().replace(/^#/, '')
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

function previewHashValue(v) {
  const s = String(v || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) return ''
  return s.length > 48 ? `${s.slice(0, 48)}…` : s
}

/** 折叠时底栏提示文案 */
const footerCollapsedHint = computed(() => {
  if (pendingGate.value) {
    if (pendingGate.value.content?.mode === 'session_start') return '确认开始 · 展开'
    if (pendingGate.value.content?.mode === 'human_input') return '请输入 · 展开'
    if (pendingGate.value.content?.mode === 'need_params') return '请输入 · 展开'
    if (pendingGate.value.content?.mode === 'adapter_question') return '工具提问 · 展开'
    if (pendingGate.value.content?.mode === 'interrupted') return '崩溃恢复 · 展开'
    if (pendingGate.value.content?.requireHuman) return '须人工同意 · 展开'
    return '待你处理 · 展开'
  }
  return '输入消息 · 展开'
})

/** 运行时：当前需要人介入（闸门 / 等人状态）→ 标红突出 */
const needsHuman = computed(() => {
  if (!detail.value) return false
  if (detail.value.session.status === 'archived') return false
  if (detail.value.session.status === 'waiting_human') return true
  if (detail.value.session.status === 'interrupted') return true
  return !!pendingGate.value
})

/**
 * 归档结果：success | failed | null
 * 依据 archive_reason；详情页可结合节点失败态
 */
function archiveOutcomeOf(session, nodes) {
  if (!session || session.status !== 'archived') return null
  const r = String(session.archive_reason || '').toLowerCase()
  if (['failed', 'rejected', 'error', 'fail'].includes(r)) return 'failed'
  if (Array.isArray(nodes) && nodes.some((n) => n.status === 'failed')) return 'failed'
  // auto_completed / completed / manual / timeout / 其它 → 成功归档
  return 'success'
}

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
  return nodes.map((n) => {
    const st = n.status || 'pending'
    let tagType = 'info'
    if (st === 'succeeded') tagType = 'success'
    else if (st === 'failed') tagType = 'danger'
    else if (st === 'waiting_human' || st === 'running') tagType = 'warning'

    const inText = cleanAnnounceIo(formatBusinessIo(n.input, 'input'))
    const outText = cleanAnnounceIo(formatBusinessIo(n.output, 'output'))
    const noteRaw =
      n.output && typeof n.output === 'object' && n.output.humanNote
        ? String(n.output.humanNote).trim()
        : ''
    const act =
      n.output?.humanAction === 'reject'
        ? '拒绝'
        : n.output?.humanAction === 'approve'
          ? '通过'
          : n.output?.humanAction === 'pending' || st === 'waiting_human'
            ? 'pending'
            : ''
    const note = noteRaw ? (act ? `${act}：${noteRaw}` : noteRaw) : ''

    // 节点级 # 参数（入/出里的 params / paramsList）
    const nodeHash = []
    const seen = new Set()
    const pushHash = (key, val) => {
      if (!key || seen.has(key)) return
      seen.add(key)
      nodeHash.push({ key, value: val == null ? '' : String(val) })
    }
    const ioParams = {
      ...(n.input?.params && typeof n.input.params === 'object' ? n.input.params : {}),
      ...(n.output?.params && typeof n.output.params === 'object' ? n.output.params : {}),
    }
    const ioList = Array.isArray(n.input?.paramsList)
      ? n.input.paramsList
      : Array.isArray(n.output?.paramsList)
        ? n.output.paramsList
        : []
    ioList.forEach((v, i) => pushHash(`#${i + 1}`, v))
    Object.keys(ioParams)
      .filter((k) => k.startsWith('#'))
      .sort((a, b) => {
        const na = /^#\d+$/.test(a) ? Number(a.slice(1)) : 9999
        const nb = /^#\d+$/.test(b) ? Number(b.slice(1)) : 9999
        if (na !== nb) return na - nb
        return a.localeCompare(b, 'zh')
      })
      .forEach((k) => pushHash(k, ioParams[k]))

    let pendingHint = ''
    if (st === 'pending' || st === 'not_run') pendingHint = '待跑'
    else if (st === 'running') pendingHint = '执行中…'
    else if (st === 'waiting_human' && !outText && !note) pendingHint = '待确认'

    return {
      id: n.id,
      idx: Number(n.step_index) + 1,
      title: n.title || `步骤 ${Number(n.step_index) + 1}`,
      statusLabel: statusLabel(st) || st,
      tagType,
      nodeHash,
      inText,
      outText,
      note,
      pendingHint,
    }
  })
})

/** 去掉无信息量的入出文案 */
function cleanAnnounceIo(text) {
  let t = String(text || '').trim()
  if (
    !t ||
    t === '（无）' ||
    t === '（空）' ||
    t === '（暂无实质产出）' ||
    t === '（无业务摘要）'
  ) {
    return ''
  }
  // 过滤纯空话行，保留「结果：」与实质内容
  t = t
    .split(/\r?\n/)
    .filter((line) => {
      const s = line.trim()
      if (!s) return false
      if (/开始执行|已结束任务/.test(s) && s.length < 24) return false
      if (/^状态：等待/.test(s)) return false
      return true
    })
    .join('\n')
    .trim()
  return t
}

/** 底部唯一输入框：有闸门时兼作附言/人工输入 */
const composerPlaceholder = computed(() => {
  const g = pendingGate.value
  if (!g) return '发消息… @成员 · #参数 · @节点重跑'
  const mode = g.content?.mode
  if (mode === 'session_start') {
    if (g.content?.callArgs || g.content?.captureParams === false) {
      return '可选参数全文作 #a；点「通过」启动…'
    }
    return g.content?.captureParams
      ? '可先输入说明/参数，再点「通过」启动…'
      : '可先输入说明，再点「通过」启动…'
  }
  if (mode === 'human_input' || mode === 'need_params') {
    return g.content?.captureParams || mode === 'need_params'
      ? '在此输入参数（空格/换行分段 → #1 #2…），Enter 或点「提交」'
      : '在此输入内容，Enter 或点「提交」'
  }
  if (mode === 'adapter_question') {
    return '工具在问你：可点选项，或先输入再提交'
  }
  if (mode === 'interrupted') {
    return '服务曾中断：继续=从中断处恢复 · 放弃=跳过未完成步骤（进程到设置里释放）'
  }
  // 通用审核（产出审核/节点审核等）：把闸门标题放进 placeholder
  const gateTitle = g.content?.text || g.content?.title
  return gateTitle ? `${gateTitle} · 可先写意见，再点「同意」或「拒绝」` : '可先写意见，再点「同意」或「拒绝」…'
})

const composerToolbarHint = computed(() => {
  if (pendingGate.value) {
    const mode = pendingGate.value.content?.mode
    if (mode === 'human_input' || mode === 'need_params') return '下方输入 · Enter 提交'
    if (mode === 'session_start') return 'Enter=发消息 · 点「通过」启动'
    if (mode === 'interrupted') return '点「继续」或「放弃」'
    if (mode === 'adapter_question') return '点选项或提交回答工具'
    return 'Enter=附言 · 点同意/拒绝定局'
  }
  return '@ 成员/节点 · # 参数 · / 指令 · Enter 发送'
})

/** 同意/拒绝旁已有闸门详情 i，不再并排第二个 */
const showComposerHintI = computed(() => {
  if (!pendingGate.value) return true
  const mode = pendingGate.value.content?.mode
  return ['session_start', 'human_input', 'need_params', 'adapter_question', 'interrupted'].includes(
    mode,
  )
})

const composerFooterHint = computed(() => {
  if (pendingGate.value) {
    return '待确认与消息共用下方输入框 · 附言会记入群报告'
  }
  return '# 插入正文（群聊/文件夹/参数/输出）· @成员协助 · 发送会写入 # 与群报告'
})

function statusLabel(s) {
  if (s === 'pending' || s === 'not_run') return '待跑'
  if (s === 'waiting_human') return '待确认'
  const m = {
    active: '进行中',
    interrupted: '待恢复',
    archived: '已归档',
    failed: '失败',
    paused: '暂停',
    running: '执行中',
    succeeded: '完成',
    skipped: '已绕过',
  }
  return m[s] || nodeStatusLabel(s) || s
}

function nodeBypassed(n) {
  return !!(n?.output?.bypassed || n?.input?.bypassed)
}

function stepTypeLabel(t) {
  return sharedStepTypeLabel(t) || t
}

function statusType(s) {
  // 已归档用中性 info，成功/失败另用 archiveOutcomeTag
  if (s === 'archived') return 'info'
  // 运行时等人：用危险色，强制注意
  if (s === 'waiting_human') return 'danger'
  if (s === 'interrupted') return 'warning'
  if (s === 'failed') return 'danger'
  return 'success'
}

function formatTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function roleLabel(m) {
  if (m.role === 'user') return '我'
  if (m.type === 'gate') {
    if (m.content?.mode === 'session_start') return '确认开始'
    if (m.content?.mode === 'human_input') return '请输入'
    if (m.content?.mode === 'need_params') return '请输入'
    if (m.content?.mode === 'interrupted') return '崩溃恢复'
    if (m.content?.mode === 'adapter_question') return '工具提问'
    return '待你处理'
  }
  if (m.role === 'system') return '系统'
  if (m.member_id) {
    const mem = members.value.find((x) => x.id === m.member_id)
    return mem?.display_name || '成员'
  }
  if (m.role === 'assistant' || m.role === 'member') return '成员'
  return m.role || '未知'
}

/** 气泡上展示的发送人简称 */
function shortSender(m, fullName) {
  const full = fullName || roleLabel(m)
  if (!full) return '?'
  if (full === '我' || full === '系统' || full === '待你处理' || full === '闸门' || full === '成员') return full
  if (full === '请输入' || full === '人工输入') return '输入'
  // 中文名：最多 4 字，超过取前 2 字作简称
  if (/[\u4e00-\u9fff]/.test(full)) {
    if (full.length <= 4) return full
    return full.slice(0, 2)
  }
  // 英文 / 混合：多词取首字母，否则截 4 字符
  const parts = full.split(/[\s._-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return parts
      .map((p) => p[0])
      .join('')
      .slice(0, 4)
      .toUpperCase()
  }
  return full.length <= 6 ? full : full.slice(0, 4)
}

function messageText(m) {
  const t = m.content?.text
  if (t != null && String(t).length) return String(t)
  if (m.content?.attachments?.length) return ''
  if (m.content && typeof m.content === 'object' && !m.content.text) {
    return JSON.stringify(m.content)
  }
  return ''
}

function formatSize(n) {
  const b = Number(n) || 0
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function fileIcon(f) {
  const mime = String(f.mime || '')
  const name = String(f.name || '')
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return '🖼'
  if (mime.includes('pdf') || /\.pdf$/i.test(name)) return '📄'
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return '📦'
  if (/\.(xlsx?|csv)$/i.test(name)) return '📊'
  if (/\.(docx?|txt|md)$/i.test(name)) return '📝'
  if (/\.(js|ts|py|json|vue|java|go)$/i.test(name)) return '💻'
  return '📎'
}

function isPendingGate(m) {
  if (m.type !== 'gate' || !detail.value) return false
  if (m.content?.mode === 'archive_confirm') return false
  if (m.content?.mode === 'adapter_question') {
    return m.content?.humanAction === 'pending' && !m.content?.answered
  }
  const node = detail.value.nodes.find((n) => n.id === m.node_instance_id)
  return node?.status === 'waiting_human'
}

function isCurrent(n) {
  if (!detail.value) return false
  if (n.step_type === 'offsite') return false
  const s = detail.value.session
  if (s.status === 'archived') return false
  return (
    n.step_index === s.current_step_index &&
    n.status !== 'succeeded' &&
    n.status !== 'skipped'
  )
}

function isWaitingHuman(n) {
  if (n.step_type === 'offsite') return n.status === 'waiting_human' || n.status === 'running'
  return n.status === 'waiting_human' || (isCurrent(n) && n.step_type === 'human')
}

/** 是否正处在场外协助（已归档则不算活跃） */
const offsiteActive = computed(() => {
  const s = detail.value?.session
  if (!s || s.status === 'archived') return false
  const ctx = s.context && typeof s.context === 'object' ? s.context : {}
  if (ctx.offsiteAssist?.archived && ctx.offsiteAssist?.active === false) return false
  if (ctx.offsiteAssist?.active) return true
  return (detail.value?.nodes || []).some(
    (n) =>
      n.step_type === 'offsite' &&
      !n.output?.archived &&
      (n.status === 'running' || n.status === 'waiting_human'),
  )
})

/** planned | interrupt */
const offsiteMode = computed(() => {
  const ctx = detail.value?.session?.context
  if (ctx?.offsiteAssist?.mode === 'planned' || ctx?.offsiteAssist?.planned) return 'planned'
  const n = activeOffsiteNode.value
  if (n?.output?.mode === 'planned' || n?.output?.plannedPause) return 'planned'
  if (offsiteActive.value) return 'interrupt'
  return null
})

const activeOffsiteNode = computed(() => {
  const nodes = detail.value?.nodes || []
  const ctx = detail.value?.session?.context
  const pinned = ctx?.offsiteAssist?.active ? ctx.offsiteAssist?.nodeInstanceId : null
  if (pinned) {
    const hit = nodes.find(
      (n) =>
        n.id === pinned &&
        n.step_type === 'offsite' &&
        !n.output?.archived,
    )
    if (hit) return hit
  }
  return (
    nodes.find(
      (n) =>
        n.step_type === 'offsite' &&
        !n.output?.archived &&
        (n.status === 'running' || n.status === 'waiting_human'),
    ) || null
  )
})

/** 多段场外并存时，仅高亮当前活跃段落 */
function isCurrentOffsiteSegment(n) {
  if (!n || n.step_type !== 'offsite' || n.output?.archived) return false
  if (n.status !== 'running' && n.status !== 'waiting_human') return false
  return activeOffsiteNode.value?.id === n.id
}

function offsiteEntryLabel(n) {
  if (!n || n.step_type !== 'offsite') return ''
  if (!isCurrentOffsiteSegment(n)) return ''
  const mode =
    n.output?.mode ||
    (n.output?.plannedPause ? 'planned' : null) ||
    offsiteMode.value
  if (mode === 'planned') return '计划'
  return '插队'
}

/**
 * 临时协助实际 @ 到的成员——从结构化的 output.lastInvoked / output.assists[].invoked
 * 里取真实成员名，不去猜 input.text 里的 "@xxx" 文字。可能有多轮、多个成员，去重后
 * 按出现顺序返回，供展开前的标题/meta 行直接标出「用了哪个工具」。
 */
function offsiteInvokedMembers(n) {
  if (!n || n.step_type !== 'offsite') return []
  const out = n.output || {}
  const names = []
  const seen = new Set()
  const collect = (list) => {
    for (const item of Array.isArray(list) ? list : []) {
      const name = String(item?.memberName || '').trim()
      if (name && !seen.has(name)) {
        seen.add(name)
        names.push(name)
      }
    }
  }
  for (const assist of Array.isArray(out.assists) ? out.assists : []) {
    collect(assist?.invoked)
  }
  collect(out.lastInvoked)
  return names
}

function offsiteInvokedLabel(n) {
  const names = offsiteInvokedMembers(n)
  return names.length ? names.map((name) => `@${name}`).join('、') : ''
}

/** 审核三态：pending | approve | reject */
function reviewAction(n) {
  const a = n?.output?.humanAction
  if (a === 'approve' || a === 'reject' || a === 'pending') return a
  if (n?.status === 'waiting_human') return 'pending'
  return ''
}

function reviewLabel(n) {
  const a = reviewAction(n)
  if (a === 'approve') return '通过'
  if (a === 'reject') return '拒绝'
  if (a === 'pending') return 'pending'
  return ''
}

function flowClass(n) {
  if (n.step_type === 'offsite') {
    if (n.status === 'running' || n.status === 'waiting_human') return 'offsite-active'
    return 'offsite-idle'
  }
  if (n.step_type === 'archive') {
    if (n.status === 'waiting_human') return 'human-wait'
    if (n.status === 'succeeded') return 'done'
    return 'pending'
  }
  if (n.status === 'succeeded' || n.status === 'skipped') return 'done'
  if (n.status === 'failed') return 'failed'
  if (isWaitingHuman(n) || n.status === 'waiting_human') return 'human-wait'
  // 执行中：呼吸焦点；当前待跑：静态高亮
  if (n.status === 'running') return 'running'
  if (isCurrent(n)) return 'current'
  if (n.step_type === 'human' || n.gate) return 'human-config'
  return 'pending'
}

function toggleNodeExpand(n) {
  expandedNodeId.value = expandedNodeId.value === n.id ? null : n.id
}

/** 流程轨 I/O：业务摘要（用户输入 / 完成概况），不堆 id·路径·命令 */
function formatIo(val, role = 'auto') {
  try {
    return formatBusinessIo(val, role)
  } catch {
    if (val == null) return '（无）'
    if (typeof val === 'string') return val || '（空）'
    return '（无业务摘要）'
  }
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
    if (s?.grok?.surface === 'tui') furnaceSurface.value = 'tui'
    else furnaceSurface.value = 'chat'
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
  activeId.value = id
  terminalBridge.resetTerminals?.()
  _router.replace(`/workbench/${id}`)
  rightTab.value = 'flow' // 默认展示流程 Tab
  expandedSkippedFlowGroups.value = {}
  terminalBridge.bindWs?.(id)
  await Promise.all([loadDetail(id), terminalBridge.loadTerminals?.(id)])
  terminalBridge.revealFurnaceTui?.()
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
function openDocsHub() {
  if (!activeId.value) return
  window.open(
    `/docs?session=${encodeURIComponent(activeId.value)}&file=${encodeURIComponent('ANNOUNCEMENT.md')}`,
    '_blank',
    'noopener',
  )
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

function adapterChoices(m) {
  return Array.isArray(m?.content?.choices) ? m.content.choices.filter(Boolean) : []
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
    slashOpen.value = true
    atOpen.value = false
    hashOpen.value = false
    const body = text.slice(1)
    slashQuery.value = body.split(/\s/)[0] || ''
    slashIndex.value = 0
  } else {
    // 删掉 /、清空输入、或改成普通消息：同步收起快捷指令气泡
    slashOpen.value = false
    slashQuery.value = ''
  }
}

/** 光标在末尾的 @query 时弹出成员面板 */
function syncAtFromInput() {
  const text = readSenderText()
  if (text.startsWith('/')) {
    atOpen.value = false
    return
  }
  // 最后一个未完成的 @片段（@ 后不含空格）
  const m = text.match(/(^|[\s])@([^\s@]*)$/)
  if (m) {
    atOpen.value = true
    slashOpen.value = false
    hashOpen.value = false
    atQuery.value = m[2] || ''
    atIndex.value = 0
  } else if (!text.endsWith('@')) {
    // 已选完 @名字 或无 @：关面板
    atOpen.value = false
    atQuery.value = ''
  }
}

/** 光标在末尾的 #query 时弹出文本快捷面板 */
function syncHashFromInput() {
  if (Date.now() < hashInsertLockUntil) return
  const text = readSenderTextRaw().replace(/\s+$/u, '')
  if (text.startsWith('/')) {
    hashOpen.value = false
    return
  }
  // 末尾 #片段：允许无前导空格（如 build#）
  const m = text.match(/(?:^|[\s])#([^\s#]*)$/u)
  if (m) {
    hashOpen.value = true
    slashOpen.value = false
    atOpen.value = false
    hashQuery.value = m[1] || ''
    hashIndex.value = 0
  } else if (!/#([^\s#]*)$/u.test(text)) {
    hashOpen.value = false
    hashQuery.value = ''
  }
}

function onSenderChange() {
  syncSlashFromInput()
  syncAtFromInput()
  syncHashFromInput()
}

function onComposerKeydown(e) {
  // # 面板：群聊 / 文件夹 / #1…
  if (hashOpen.value) {
    const list = filteredHashItems.value
    if (e.key === 'Escape') {
      e.preventDefault()
      hashOpen.value = false
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!list.length) return
      hashIndex.value = (hashIndex.value + 1) % list.length
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!list.length) return
      hashIndex.value = (hashIndex.value - 1 + list.length) % list.length
      return
    }
    if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
      if (!list.length) return
      e.preventDefault()
      e.stopPropagation()
      insertHashItem(list[hashIndex.value] || list[0])
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
  if (atOpen.value) {
    const members = filteredAtMembers.value
    const total = members.length
    if (e.key === 'Escape') {
      e.preventDefault()
      atOpen.value = false
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!total) return
      atIndex.value = (atIndex.value + 1) % total
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!total) return
      atIndex.value = (atIndex.value - 1 + total) % total
      return
    }
    if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
      if (!total) return
      e.preventDefault()
      e.stopPropagation()
      insertAtMember(members[atIndex.value] || members[0])
      return
    }
  }

  if (!slashOpen.value) {
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
    slashOpen.value = false
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!list.length) return
    slashIndex.value = (slashIndex.value + 1) % list.length
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (!list.length) return
    slashIndex.value = (slashIndex.value - 1 + list.length) % list.length
    return
  }
  if (e.key === 'Enter' && !e.shiftKey && list.length) {
    // 指令模式：Enter 执行选中项，不发消息
    const t = readSenderText()
    if (t.startsWith('/')) {
      e.preventDefault()
      e.stopPropagation()
      runSlash(list[slashIndex.value] || list[0])
    }
  }
}

function toggleSlashPanel() {
  atOpen.value = false
  hashOpen.value = false
  slashOpen.value = !slashOpen.value
  if (slashOpen.value) {
    slashQuery.value = ''
    slashIndex.value = 0
    // setText 是插入：只追加唤起符
    appendSenderText('/')
    syncSlashFromInput()
  }
}

/** 关闭 / @ # 浮层（与 Esc 一致，不关输入框里的唤起符） */
function closeComposerPanel(kind) {
  if (kind === 'slash') {
    slashOpen.value = false
    slashQuery.value = ''
    return
  }
  if (kind === 'at') {
    atOpen.value = false
    atQuery.value = ''
    return
  }
  if (kind === 'hash') {
    hashOpen.value = false
    hashQuery.value = ''
  }
}

function toggleAtPanel() {
  slashOpen.value = false
  hashOpen.value = false
  atOpen.value = !atOpen.value
  if (atOpen.value) {
    atQuery.value = ''
    atIndex.value = 0
    const cur = readSenderText()
    appendSenderText(cur && !/\s$/.test(cur) ? ' @' : '@')
    syncAtFromInput()
  }
}

function toggleHashPanel() {
  slashOpen.value = false
  atOpen.value = false
  hashOpen.value = !hashOpen.value
  if (hashOpen.value) {
    hashQuery.value = ''
    hashIndex.value = 0
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
  atOpen.value = false
  atQuery.value = ''
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
  if (hashOpen.value && stripped === raw.replace(/[ \t]+$/u, '')) {
    stripped = stripTrailingHashTrigger(`${stripped}#`)
  }
  hashOpen.value = false
  hashQuery.value = ''
  if (!insert) {
    await replaceSenderText(stripped)
    ElMessage.warning(`${h.name || h.label || '该项'}暂无内容可插入`)
    return
  }
  await replaceSenderText(stripped ? `${stripped} ${insert}` : insert)
}

function isDiscardedUnexecutedNode(n) {
  return isDiscardedUnexecutedFlowNode(n, {
    currentStepIndex: detail.value?.session?.current_step_index,
    isCurrent: isCurrent(n),
  })
}

/**
 * 将相邻的「未跑过且已废弃」节点归为一段并默认收起。
 * 已执行节点（成功/失败/执行中/场外）和当前轨将要跑的节点保持展开。
 */
const flowEntries = computed(() => {
  const entries = []
  for (const node of detail.value?.nodes || []) {
    if (node.step_type === 'archive') continue
    const previous = entries.at(-1)
    if (isDiscardedUnexecutedNode(node) && previous?.type === 'skipped') {
      previous.nodes.push(node)
      previous.key = `skipped-${previous.nodes[0].id}-${node.id}`
    } else if (isDiscardedUnexecutedNode(node)) {
      entries.push({ type: 'skipped', key: `skipped-${node.id}-${node.id}`, nodes: [node] })
    } else {
      entries.push({ type: 'node', key: `node-${node.id}`, nodes: [node] })
    }
  }
  return entries
})

function nodeHasAdapt(n) {
  return !!(n?.input?.adapt || n?.output?.adapt)
}

function isSkippedFlowGroupExpanded(entry) {
  return !!expandedSkippedFlowGroups.value[entry.key]
}

function toggleSkippedFlowGroup(entry) {
  expandedSkippedFlowGroups.value = {
    ...expandedSkippedFlowGroups.value,
    [entry.key]: !isSkippedFlowGroupExpanded(entry),
  }
}

function isClonedNode(n) {
  return !!(n?.output?.cloned || n?.input?.cloned)
}

/** 当前世代起点：最近一次克隆批次，否则当前步及之后（仅用于历史样式，不再折叠） */
const flowHistorySplitIndex = computed(() => {
  const nodes = detail.value?.nodes || []
  if (!nodes.length) return 0
  const last = detail.value?.session?.context?.lastRestart
  const batch = last?.cloneBatchId
  if (batch) {
    const i = nodes.findIndex(
      (n) => (n.output?.cloneBatchId || n.input?.cloneBatchId) === batch,
    )
    if (i > 0) return i
  }
  const cur = Number(detail.value?.session?.current_step_index)
  if (!Number.isFinite(cur)) return 0
  const i = nodes.findIndex((n) => Number(n.step_index) >= cur)
  return i > 0 ? i : 0
})

function isFlowHistoryNode(n) {
  const nodes = detail.value?.nodes || []
  const i = nodes.findIndex((x) => x.id === n.id)
  return i >= 0 && i < flowHistorySplitIndex.value
}

/** 流程轨应锚定滚动的节点：场外当前段 → 待确认 → 执行中 → 当前步 → 游标步 */
const flowAnchorNodeId = computed(() => {
  const nodes = detail.value?.nodes || []
  if (!nodes.length) return null
  const off = activeOffsiteNode.value
  if (off?.id) return off.id
  const archWait = nodes.find(
    (n) => n.step_type === 'archive' && n.status === 'waiting_human' && isCurrent(n),
  )
  if (archWait) return archWait.id
  const waitingAtCur = nodes.find(
    (n) => n.status === 'waiting_human' && Number(n.step_index) === Number(detail.value?.session?.current_step_index),
  )
  if (waitingAtCur) return waitingAtCur.id
  const waiting = [...nodes].reverse().find((n) => n.status === 'waiting_human')
  if (waiting) return waiting.id
  const running = nodes.find((n) => n.status === 'running')
  if (running) return running.id
  const cur = nodes.find((n) => isCurrent(n))
  if (cur) return cur.id
  const idx = Number(detail.value?.session?.current_step_index)
  if (Number.isFinite(idx)) {
    const byIdx = nodes.find((n) => Number(n.step_index) === idx)
    if (byIdx) return byIdx.id
  }
  return nodes[nodes.length - 1]?.id || null
})

function scrollFlowToAnchor() {
  if (rightTab.value !== 'flow') return
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
    rightTab.value = 'flow'
    footerCollapsed.value = false
    await loadDetail(activeId.value)
    sessions.value = await api.sessions.list()
    const focusId = r.nodeInstanceId || n.id
    expandedNodeId.value = focusId
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
    slashOpen.value = false
    slashQuery.value = ''
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
      filteredSlashCmds.value[slashIndex.value]
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
  try {
    await ElMessageBox.confirm('确认删除该聊天？不可恢复', '删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
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
  slashOpen.value = false
  slashQuery.value = ''
  slashIndex.value = 0
  atOpen.value = false
  atQuery.value = ''
  atIndex.value = 0
  hashOpen.value = false
  hashQuery.value = ''
  hashIndex.value = 0
  pendingFiles.value = []
  uploading.value = false
  footerCollapsed.value = false
  expandedNodeId.value = null
  expandedSkippedFlowGroups.value = {}
  rightTab.value = 'flow'
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
  furnaceSurface.value = 'chat'
}

export function initSessionDetail({ route, router }) {
  setWorkbenchContext({ route, router })
  resetSessionState()
  // 出现待处理闸门时自动展开底栏，避免漏操作
  _stopWatchers.push(
    watch(pendingGate, (g) => {
      if (g) footerCollapsed.value = false
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
      [flowAnchorNodeId, () => rightTab.value, () => detail.value?.nodes?.length],
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
  slashOpen,
  slashQuery,
  slashIndex,
  atOpen,
  atQuery,
  atIndex,
  hashOpen,
  hashQuery,
  hashIndex,
  pendingFiles,
  uploading,
  footerCollapsed,
  expandedNodeId,
  expandedSkippedFlowGroups,
  rightTab,
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
