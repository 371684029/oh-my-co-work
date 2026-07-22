/**
 * 可选：ACW_AUTO_EXIT=1 时向后端汇报在线状态。
 * 默认关闭——浏览器无法可靠区分「关页」与「切标签/切应用」，易误杀服务。
 */
import { api } from './api.js'

const HEARTBEAT_MS = 5000
let timer = null
let enabled = false

async function beat() {
  try {
    await fetch('/api/heartbeat', { method: 'POST' })
  } catch {
    /* ignore */
  }
}

/** 仅在真实卸载时通知；bfcache 往返（persisted）不当作关闭 */
function gone(ev) {
  try {
    if (ev && ev.persisted) return
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/client-gone', '{}')
    } else {
      fetch('/api/client-gone', { method: 'POST', keepalive: true })
    }
  } catch {
    /* ignore */
  }
}

export async function setupBrowserLifecycle() {
  try {
    const r = await api.runtime()
    enabled = !!r?.autoExit
  } catch {
    enabled = false
  }
  if (!enabled) return { enabled: false }

  beat()
  timer = setInterval(beat, HEARTBEAT_MS)

  window.addEventListener('pagehide', gone)
  // beforeunload 在刷新/关页都会触发；与 pagehide 互补，仍受服务端宽限约束
  window.addEventListener('beforeunload', () => gone({ persisted: false }))
  document.addEventListener('visibilitychange', () => {
    // 切回前台补心跳；切走不发 client-gone（避免误杀）
    if (document.visibilityState === 'visible') beat()
  })

  return { enabled: true }
}

export function stopBrowserLifecycle() {
  if (timer) clearInterval(timer)
  timer = null
}
