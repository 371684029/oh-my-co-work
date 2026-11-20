import { watch } from 'vue'
import ElMessage from 'element-plus/es/components/message/index.mjs'
import { furnaceGuiTranscript, isFurnaceMember } from '@acw/shared'
import { syncFurnaceSpriteState } from '../../../composables/furnaceUi'
import { isTerminalRunning } from '../../../composables/terminalStatus'
import {
  loadLists,
  selectSession,
  members,
  startTarget,
  startChat,
  detail,
  pendingGate,
} from './useSessionDetail'
import {
  terminalSessions,
  isFurnaceTuiContext,
  reopenFurnaceProcess,
  ensureFurnaceAgent,
} from './useTerminalSessions'
import { api } from '../../../api.js'
import {
  consumeFurnaceBindIntent,
  consumeFurnaceRefinePrefill,
  decideFurnaceProcess,
  furnacePlainTextHasUserTask,
  resolveFurnaceLaunchAgent,
} from '../../../composables/refineFurnaceLaunch.js'
import { pickLiveFurnaceTerminal } from '../../../composables/furnaceReopen.js'
import { writeClipboardText } from '../../../composables/terminalClipboardBridge.js'

/**
 * 桌宠三态同步 + 熔炉开炉 的模块级单例。
 * 汇总 useSessionDetail / useTerminalSessions 的状态，驱动 furnaceSpriteState，
 * 并负责「?furnace=1」开炉与启动时的会话装载。
 */

let _route = null
let _router = null
let _stopWatchers = []
let furnaceLaunchLock = false

async function launchFurnaceFromSprite() {
  if (furnaceLaunchLock) return
  furnaceLaunchLock = true
  try {
    await loadLists()
    const m = (members.value || []).find((x) => isFurnaceMember(x))
    if (!m) {
      ElMessage.warning('未找到熔炉成员')
      return
    }
    const intent = consumeFurnaceBindIntent()
    const nextMemberId = String(intent?.memberId || _route.query.refineMemberId || '').trim()
    // startChat replaces /workbench?agent= with /workbench/:id and drops the query.
    const launchAgent = resolveFurnaceLaunchAgent({ intent, query: _route.query })
    const agent = launchAgent === 'cursor' ? 'cursor' : 'grok'
    const agentLabel = agent === 'cursor' ? 'Cursor' : 'Grok'
    const anyLiveBefore = (terminalSessions.value || []).some(
      (t) => isFurnaceTuiContext(t) && isTerminalRunning(t.status),
    )
    if (!nextMemberId && !anyLiveBefore) {
      try {
        await api.furnace.setFocus({ action: 'arm-free' })
      } catch {
        /* focus file is optional until the process starts */
      }
    }
    startTarget.value = `m:${m.id}`
    const s = await startChat({ quiet: true })
    if (!s) return
    const anyLive = (terminalSessions.value || []).some(
      (t) => isFurnaceTuiContext(t) && isTerminalRunning(t.status),
    )
    const liveTerminal = pickLiveFurnaceTerminal(terminalSessions.value, {
      agent,
      isFurnaceTuiContext,
      isTerminalRunning,
    })
    const live = nextMemberId ? !!liveTerminal : anyLive
    const plain = liveTerminal?.replay
      ? furnaceGuiTranscript(liveTerminal.replay, {
          cols: liveTerminal.cols,
          rows: liveTerminal.rows,
          profile: agent === 'cursor' ? 'cursor' : 'grok',
        })
      : ''
    const hasUserTask = furnacePlainTextHasUserTask(plain)
    const decision = decideFurnaceProcess({
      live,
      seenMemberId: intent?.seenMemberId || '',
      nextMemberId,
      hasUserTask,
    })
    let didReopen = false
    if (decision === 'focus') {
      try {
        await api.furnace.setFocus({ action: 'disarm-free' })
      } catch {
        /* ignore */
      }
      ElMessage.success('已打开熔炉')
    } else if (decision === 'continue') {
      const name = intent?.displayName || '这个工具'
      ElMessage.success(`还是 ${name}，接着聊。它不会自动重读；要它改口，就说一声重新看 ACTIVE。`)
    } else if (decision === 'confirm-restart' || decision === 'restart' || decision === 'start') {
      if (s.reused && (decision !== 'start' || !live)) {
        const opened = await reopenFurnaceProcess({
          skipConfirm: decision !== 'confirm-restart',
          quiet: decision !== 'confirm-restart',
          agent,
        })
        didReopen = true
        if (opened && decision === 'restart') ElMessage.success('已换到这个工具，熔炉已新开')
        if (opened && decision === 'start') ElMessage.success(`已新开熔炉，${agentLabel} 对话已清空`)
        if (!opened && decision === 'start') ElMessage.warning('没能新开熔炉')
      } else if (!s.reused) {
        ElMessage.success('已打开熔炉')
      }
    } else if (decision === 'start-free') {
      if (s.reused && !live) {
        const opened = await reopenFurnaceProcess({ skipConfirm: true, quiet: true, agent })
        didReopen = true
        if (opened) ElMessage.success(`已新开熔炉，${agentLabel} 对话已清空`)
        else ElMessage.warning('没能新开熔炉')
      } else {
        ElMessage.success('已打开熔炉')
      }
    }
    const pre = consumeFurnaceRefinePrefill()
    const focusAgent =
      launchAgent === 'cursor' || String(pre.agent || '').toLowerCase() === 'cursor' ? 'cursor' : agent
    const namedAgent = launchAgent === 'grok' || launchAgent === 'cursor' || !!pre.agent
    const advanceWillStartGrok = !s.reused && focusAgent === 'grok'
    if (namedAgent && !didReopen && !advanceWillStartGrok && decision !== 'focus') {
      try {
        await ensureFurnaceAgent(focusAgent === 'cursor' ? 'cursor' : 'grok')
      } catch {
        /* ignore */
      }
    }
    if (pre.prompt) {
      try {
        await writeClipboardText(pre.prompt)
        ElMessage.success('炼化任务已复制，请在熔炉 TUI 中粘贴发送')
      } catch {
        ElMessage.info('炼化任务较长，请在设置弹窗中再次复制')
      }
    }
    if (_route.query.furnace || _route.query.agent || _route.query.refineMemberId) {
      const q = { ..._route.query }
      delete q.furnace
      delete q.agent
      delete q.refineMemberId
      _router.replace({ path: _route.path, query: q })
    }
  } finally {
    furnaceLaunchLock = false
  }
}

export function initFurnaceSync({ route, router }) {
  _route = route
  _router = router
  furnaceLaunchLock = false
  // 桌宠三态：闸门 / 会话状态 / 终端 / 节点
  _stopWatchers.push(
    watch(
      [
        pendingGate,
        terminalSessions,
        () => detail.value?.session?.status,
        () => detail.value?.nodes,
      ],
      () => {
        syncFurnaceSpriteState({
          pendingGate: pendingGate.value,
          sessionStatus: detail.value?.session?.status,
          terminals: terminalSessions.value,
          nodes: detail.value?.nodes,
        })
      },
      { immediate: true },
    ),
  )
  // ?furnace=1 开炉
  _stopWatchers.push(
    watch(
      () => _route.query.furnace,
      (v) => {
        if (v === '1' || v === 'true') launchFurnaceFromSprite()
      },
    ),
  )
}

export function disposeFurnaceSync() {
  _stopWatchers.forEach((stop) => stop())
  _stopWatchers = []
}

/** 启动装载：拉列表 → 有 sessionId 则选中 → 有 ?furnace 则开炉 */
export function startWorkbench() {
  loadLists().then(() => {
    const sid = _route.params.sessionId
    if (sid) selectSession(sid)
    if (_route.query.furnace === '1' || _route.query.furnace === 'true') {
      launchFurnaceFromSprite()
    }
  })
}

export { launchFurnaceFromSprite }
