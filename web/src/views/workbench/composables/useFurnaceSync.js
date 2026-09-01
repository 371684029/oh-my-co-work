import { watch } from 'vue'
import { ElMessage } from 'element-plus'
import { isFurnaceMember } from '@acw/shared'
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
} from './useTerminalSessions'

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
    startTarget.value = `m:${m.id}`
    const s = await startChat({ quiet: true })
    if (!s) return
    if (s.reused) {
      const live = (terminalSessions.value || []).some(
        (t) =>
          isFurnaceTuiContext(t) && isTerminalRunning(t.status),
      )
      if (!live) {
        await reopenFurnaceProcess({ skipConfirm: true, quiet: true })
        ElMessage.success('已新开熔炉，Grok 对话已清空')
      } else {
        ElMessage.success('已打开熔炉')
      }
    } else {
      ElMessage.success('已打开熔炉')
    }
    if (_route.query.furnace) {
      const q = { ..._route.query }
      delete q.furnace
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
