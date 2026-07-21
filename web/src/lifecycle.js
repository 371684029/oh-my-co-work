/**
 * 压缩包 / 一键启动模式：向后端汇报浏览器仍在线；关闭窗口后服务自动退出。
 */
import { api } from './api.js'

const HEARTBEAT_MS = 4000
let timer = null
let enabled = false

async function beat() {
  try {
    await fetch('/api/heartbeat', { method: 'POST' })
  } catch {
    /* ignore */
  }
}

function gone() {
  try {
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
  window.addEventListener('beforeunload', gone)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') beat()
  })

  return { enabled: true }
}

export function stopBrowserLifecycle() {
  if (timer) clearInterval(timer)
  timer = null
}
