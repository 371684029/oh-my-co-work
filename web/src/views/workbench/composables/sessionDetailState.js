/**
 * useSessionDetail 模块级单例状态（FE-01/ENG-04 拆分自 useSessionDetail.js）。
 * 终端相关（WS / replay / seq）在 useTerminalSessions.js，经 terminalBridge 注入以打破循环依赖。
 * 命名 ESM 导出为活绑定：消费者（含 useSessionDetail 的 export *）拿到的是同一实例。
 */
import { ref } from 'vue'

// ===== 终端桥：由 useTerminalSessions 注入 =====
export const terminalBridge = {}

// ===== 流程轨滚动计时器 =====
export const flowScrollTimerRef = { id: 0 }

// ===== 列表 =====
export const sessions = ref([])
export const groups = ref([])
export const members = ref([])
export const slashCommands = ref([])

// ===== 会话详情 =====
export const detail = ref(null)
export const activeId = ref(null)
export const editTitle = ref('')
export const sessionNotesDraft = ref('')

// ===== 开聊 =====
export const startTarget = ref('')
export const startingChat = ref(false)

// ===== 发送 / 闸门 =====
export const sending = ref(false)
export const gating = ref(false)

// ===== 输入区 =====
/** XSender 实例：该组件无可靠 v-model，提交时用 ref 取文 */
export const senderRef = ref(null)

// ===== 输入历史游标（mutable let + getter/setter 桥，整体迁移保持语义）=====
export let composerHistIndex = -1
export const composerHistIndexRef = {
  get index() {
    return composerHistIndex
  },
  set index(v) {
    composerHistIndex = v
  },
}
export const composerDraftTimerRef = { id: 0 }

// ===== # 快捷覆写输入锁（mutable let，三个消费者共用一个标量）=====
export let hashInsertLockUntil = 0
export const hashInsertLockUntilRef = {
  get until() {
    return hashInsertLockUntil
  },
}
/** 刚用 # 快捷覆写输入框后，短暂忽略 sync，避免面板闪回 */
export function bumpHashInsertLock() {
  hashInsertLockUntil = Date.now() + 300
}
export function clearHashInsertLock() {
  hashInsertLockUntil = 0
}

// ===== 待发送附件 =====
export const pendingFiles = ref([])
export const uploading = ref(false)

// ===== 群报告 =====
export const announceLoading = ref(false)
export const announceOpenLoading = ref(false)
export const notesSaving = ref(false)

// ===== 终端偏好 / 熔炉表面 =====
export const terminalPrefs = ref({
  theme: 'project-dark',
  fontSize: 13,
  cursorBlink: true,
  pastePolicy: 'confirm',
  selectToCopy: false,
  autoCollapseOnExit: false,
  scrollback: 5000,
})
export const furnaceSurface = ref('tui')

// ===== 会话列表筛选 =====
export const listFilter = ref('all')

// ===== 前向引用桥（两段式接线用，对象身份恒定）=====
export const deleteSessionRef = { doDelete: async () => {} }
export const gateActionsRef = {}
