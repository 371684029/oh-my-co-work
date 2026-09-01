import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { isFurnaceMember } from '@acw/shared'
import { isTerminalRunning } from '../../../composables/terminalStatus'
import { api, connectSessionWs } from '../../../api'
import {
  terminalBridge,
  activeId,
  detail,
  members,
  loadDetail,
  rightTab,
  terminalPrefs,
  sessions,
} from './useSessionDetail'

/**
 * 终端会话 / WS 重连 / replay 累积（256k 上限）/ seq 增量 / gap 处理 的模块级单例。
 * 依赖 useSessionDetail 的会话状态（单向），并经 terminalBridge 把终端能力回注给
 * selectSession / doDelete / bubbleList，避免循环 import。
 */

const terminalSessions = ref([])
const activeTerminalId = ref(null)
const terminalConnectionStatus = ref('connecting')
const lastTerminalSize = ref(null)
let ws = null

const activeTerminal = computed(
  () => terminalSessions.value.find((terminal) => terminal.id === activeTerminalId.value) || null,
)

function isFurnaceTuiContext(terminal) {
  if (terminal?.memberId) {
    const mem = members.value.find((x) => x.id === terminal.memberId)
    if (isFurnaceMember(mem)) return true
  }
  if (isFurnaceMember({ display_name: terminal?.label, name: terminal?.label })) return true
  const fromId = detail.value?.group?.config?.fromMemberId || ''
  if (fromId) {
    const mem = members.value.find((x) => x.id === fromId)
    if (isFurnaceMember(mem)) return true
  }
  const cmd = `${terminal?.command || ''} ${terminal?.label || ''}`
  return /(^|[\s/\\])grok(\.exe)?(\s|$)/i.test(cmd)
}

const furnaceTuiPagefill = computed(() => isFurnaceTuiContext(activeTerminal.value))

function upsertTerminal(next) {
  if (!next?.id) return
  const index = terminalSessions.value.findIndex((item) => item.id === next.id)
  if (index < 0) {
    terminalSessions.value = [...terminalSessions.value, next]
    return
  }
  const current = terminalSessions.value[index]
  const merged = {
    ...current,
    ...next,
    replay: next.replay ?? current.replay ?? '',
    previewReplay: next.previewReplay ?? current.previewReplay ?? '',
  }
  terminalSessions.value = terminalSessions.value.map((item, i) => (i === index ? merged : item))
}

function sendTerminalMessage(message) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    ElMessage.warning('终端连接尚未就绪')
    return false
  }
  ws.send(JSON.stringify(message))
  return true
}

function openTerminal(terminalId) {
  activeTerminalId.value = terminalId
  sendTerminalMessage({ type: 'terminal.attach', terminalId })
}

function revealFurnaceTui(terminalId) {
  const target =
    terminalSessions.value.find((t) => t.id === terminalId) ||
    terminalSessions.value.find((t) => isTerminalRunning(t.status)) ||
    terminalSessions.value[terminalSessions.value.length - 1]
  if (!target || !isFurnaceTuiContext(target)) return
  if (activeTerminalId.value === target.id) return
  openTerminal(target.id)
}

function sendTerminalInput(data) {
  if (!activeTerminalId.value) return
  sendTerminalMessage({
    type: 'terminal.input',
    terminalId: activeTerminalId.value,
    data,
  })
}

function resizeTerminal({ cols, rows }) {
  const c = Number(cols)
  const r = Number(rows)
  if (!activeTerminalId.value) return
  if (!Number.isFinite(c) || !Number.isFinite(r) || c < 20 || r < 8) return
  lastTerminalSize.value = { cols: c, rows: r }
  sendTerminalMessage({
    type: 'terminal.resize',
    terminalId: activeTerminalId.value,
    cols: c,
    rows: r,
  })
}

async function killTerminal(terminalId) {
  if (!activeId.value || !terminalId) return
  try {
    await api.sessions.killTerminal(activeId.value, terminalId)
  } catch (e) {
    ElMessage.error(e.message || '停止终端失败')
  }
}

async function closeFurnaceProcess() {
  if (!activeId.value) return
  try {
    await ElMessageBox.confirm('结束 Grok 进程，这一轮对话会丢掉。工作台会话还在。', '关闭熔炉', {
      type: 'warning',
      confirmButtonText: '关闭',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    await api.sessions.closeFurnace(activeId.value)
    await loadTerminals(activeId.value)
    ElMessage.success('已关闭熔炉')
  } catch (e) {
    ElMessage.error(e.message || '关闭熔炉失败')
  }
}

async function reopenFurnaceProcess({ skipConfirm = false, quiet = false } = {}) {
  if (!activeId.value) return
  const live = (terminalSessions.value || []).some(
    (t) => isFurnaceTuiContext(t) && isTerminalRunning(t.status),
  )
  if (live && !skipConfirm) {
    try {
      await ElMessageBox.confirm(
        '会结束当前 Grok，再开一条空对话。工作台会话还在。',
        '新开熔炉',
        {
          type: 'warning',
          confirmButtonText: '新开',
          cancelButtonText: '取消',
        },
      )
    } catch {
      return
    }
  }
  try {
    const r = await api.sessions.reopenFurnace(activeId.value)
    await loadTerminals(activeId.value)
    const tid = r?.terminalId
    if (tid) revealFurnaceTui(tid)
    if (quiet) return
    if (r?.ok) ElMessage.success('已新开熔炉，Grok 对话已清空')
    else ElMessage.warning(r?.summary || '新开熔炉未成功')
  } catch (e) {
    ElMessage.error(e.message || '新开熔炉失败')
  }
}

function onTerminalSeqGap() {
  if (!activeTerminalId.value) return
  ElMessage.info('部分输出未回放，正在重新附着')
  sendTerminalMessage({ type: 'terminal.attach', terminalId: activeTerminalId.value })
}

async function downloadTerminalLog(terminalId) {
  if (!activeId.value || !terminalId) return
  try {
    await api.sessions.downloadTerminalLog(activeId.value, terminalId)
  } catch (e) {
    ElMessage.error(e.message || '无法下载日志')
  }
}

async function loadTerminals(id) {
  try {
    const result = await api.sessions.terminals(id)
    if (activeId.value !== id) return
    for (const terminal of result.terminals || []) {
      const current = terminalSessions.value.find((item) => item.id === terminal.id)
      if (!current || Number(terminal.seq || 0) >= Number(current.seq || 0)) {
        upsertTerminal({
          ...terminal,
          previewReplay: String(terminal.replay || '').slice(-12_000),
        })
      }
    }
    revealFurnaceTui()
  } catch {
    /* 保留 WebSocket 已收到的较新状态 */
  }
}

function bindWs(sessionId) {
  if (ws) {
    ws.close()
    ws = null
  }
  ws = connectSessionWs(
    sessionId,
    async (ev) => {
      if (activeId.value !== sessionId) return
      if (ev.type === 'terminal.opened') {
        const terminal = ev.payload?.terminal
        upsertTerminal({
          ...terminal,
          previewReplay: String(terminal?.replay || '').slice(-12_000),
        })
        revealFurnaceTui(terminal?.id)
        return
      }
      if (ev.type === 'terminal.output') {
        const terminalId = ev.payload?.terminalId
        const current = terminalSessions.value.find((item) => item.id === terminalId)
        const nextSeq = Number(ev.payload?.seq)
        const prevSeq = Number(current?.seq || 0)
        if (current && nextSeq > prevSeq) {
          if (nextSeq > prevSeq + 1) {
            ElMessage.info('部分输出未回放，正在重新附着')
            sendTerminalMessage({ type: 'terminal.attach', terminalId })
          }
          const data = ev.payload.data || ''
          const replay = `${current.replay || ''}${data}`.slice(-256_000)
          upsertTerminal({
            ...current,
            seq: ev.payload.seq,
            replay,
            previewReplay: `${current.previewReplay || ''}${data}`.slice(-12_000),
            lastChunk: data,
          })
        }
        return
      }
      if (ev.type === 'terminal.snapshot') {
        if (ev.payload?.truncated) {
          ElMessage.info('回放已截断，仅显示最近输出')
        }
        upsertTerminal({
          ...(ev.payload?.terminal || {}),
          id: ev.payload?.terminalId,
          seq: ev.payload?.seq || 0,
          replay: ev.payload?.data || '',
          previewReplay: String(ev.payload?.data || '').slice(-12_000),
          snapshotKey: `${ev.payload?.seq || 0}:${Date.now()}`,
          lastChunk: '',
          replayTruncated: !!ev.payload?.truncated,
        })
        return
      }
      if (ev.type === 'terminal.exited') {
        upsertTerminal(ev.payload?.terminal)
        if (terminalPrefs.value.autoCollapseOnExit && activeTerminalId.value === ev.payload?.terminal?.id) {
          activeTerminalId.value = null
        }
        return
      }
      if (ev.type === 'terminal.error' || ev.type === 'terminal.adapter_error') {
        ElMessage.warning(ev.payload?.message || '终端连接异常')
        return
      }
      if (
        [
          'message',
          'node.status',
          'session.archived',
          'session.restart',
          'session.status',
          'gate.request',
          'announcement.updated',
        ].includes(ev.type)
      ) {
        await loadDetail(sessionId)
        // 默认保持「流程」Tab，不自动跳群报告
        // 群报告由节点 detail / # 参数驱动；备注在 context.notes
        if (ev.type === 'session.archived' || ev.type === 'session.restart') {
          rightTab.value = 'flow'
        }
        sessions.value = await api.sessions.list()
      }
    },
    {
      async onOpen() {
        if (activeId.value !== sessionId) return
        await loadTerminals(sessionId)
        if (activeTerminalId.value) {
          sendTerminalMessage({ type: 'terminal.attach', terminalId: activeTerminalId.value })
          if (lastTerminalSize.value) {
            sendTerminalMessage({
              type: 'terminal.resize',
              terminalId: activeTerminalId.value,
              ...lastTerminalSize.value,
            })
          }
        }
      },
      onStatus(status) {
        if (activeId.value === sessionId) terminalConnectionStatus.value = status
      },
    },
  )
}

function resetTerminals() {
  activeTerminalId.value = null
  terminalSessions.value = []
}

function closeWs() {
  if (ws) {
    try {
      ws.close()
    } catch {
      /* ignore */
    }
    ws = null
  }
}

export function initTerminalSessions() {
  resetTerminals()
  terminalConnectionStatus.value = 'connecting'
  lastTerminalSize.value = null
}

export function disposeTerminalSessions() {
  closeWs()
}

// ===== 终端桥：回注给 useSessionDetail（模块级单例，加载即注册）=====
Object.assign(terminalBridge, {
  terminalSessions,
  activeTerminalId,
  resetTerminals,
  closeWs,
  bindWs,
  loadTerminals,
  revealFurnaceTui,
})

export {
  terminalSessions,
  activeTerminalId,
  terminalConnectionStatus,
  lastTerminalSize,
  activeTerminal,
  furnaceTuiPagefill,
  isFurnaceTuiContext,
  upsertTerminal,
  sendTerminalMessage,
  openTerminal,
  revealFurnaceTui,
  sendTerminalInput,
  resizeTerminal,
  killTerminal,
  closeFurnaceProcess,
  reopenFurnaceProcess,
  onTerminalSeqGap,
  downloadTerminalLog,
  loadTerminals,
  bindWs,
  resetTerminals,
  closeWs,
}
