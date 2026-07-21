/**
 * 桌面/压缩包模式生命周期：浏览器心跳丢失后自动退出进程。
 * 由 ACW_AUTO_EXIT=1 开启（一键启动默认开；npm run dev:server 默认关）。
 */
let autoExit =
  process.env.ACW_AUTO_EXIT === '1' ||
  process.env.ACW_AUTO_EXIT === 'true' ||
  process.env.ACW_AUTO_EXIT === 'yes'

/** 首次启动等待浏览器连上的宽限（ms） */
const BOOT_GRACE_MS = Number(process.env.ACW_BOOT_GRACE_MS || 90_000)
/** 曾有过心跳后，失联多久退出（ms） */
const IDLE_EXIT_MS = Number(process.env.ACW_IDLE_EXIT_MS || 12_000)
/** 页面卸载后的短宽限（覆盖刷新）（ms） */
const UNLOAD_GRACE_MS = Number(process.env.ACW_UNLOAD_GRACE_MS || 3_500)

let lastBeatAt = 0
let hadClient = false
let exitTimer = null
let startedAt = Date.now()
let exitFn = () => process.exit(0)

export function isAutoExitEnabled() {
  return autoExit
}

export function setAutoExitEnabled(v) {
  autoExit = !!v
}

export function setExitHandler(fn) {
  if (typeof fn === 'function') exitFn = fn
}

export function getLifecycleStatus() {
  return {
    autoExit,
    hadClient,
    lastBeatAt: lastBeatAt || null,
    bootGraceMs: BOOT_GRACE_MS,
    idleExitMs: IDLE_EXIT_MS,
    unloadGraceMs: UNLOAD_GRACE_MS,
    uptimeMs: Date.now() - startedAt,
  }
}

function clearExitTimer() {
  if (exitTimer) {
    clearTimeout(exitTimer)
    exitTimer = null
  }
}

function doExit(reason) {
  if (!autoExit) return
  console.log(`[acw] auto-exit: ${reason}`)
  clearExitTimer()
  try {
    exitFn(reason)
  } catch {
    process.exit(0)
  }
}

export function touchHeartbeat(meta = {}) {
  if (!autoExit) return { ok: true, ignored: true }
  lastBeatAt = Date.now()
  hadClient = true
  clearExitTimer()
  return { ok: true, autoExit: true, ...meta }
}

/** 浏览器 pagehide / beforeunload：短宽限，刷新可续命 */
export function notifyClientGone() {
  if (!autoExit) return { ok: true, ignored: true }
  clearExitTimer()
  exitTimer = setTimeout(() => {
    if (Date.now() - lastBeatAt >= UNLOAD_GRACE_MS - 200) {
      doExit('browser closed or navigated away')
    }
  }, UNLOAD_GRACE_MS)
  return { ok: true, exitingInMs: UNLOAD_GRACE_MS }
}

/** 显式关机 */
export function requestShutdown(reason = 'shutdown api') {
  doExit(reason)
  return { ok: true }
}

export function startLifecycleWatch() {
  if (!autoExit) {
    console.log('[acw] auto-exit off (dev). Set ACW_AUTO_EXIT=1 to stop with browser.')
    return
  }
  console.log(
    `[acw] auto-exit on: idle ${IDLE_EXIT_MS}ms, unload grace ${UNLOAD_GRACE_MS}ms, boot grace ${BOOT_GRACE_MS}ms`,
  )
  setInterval(() => {
    if (!autoExit) return
    const now = Date.now()
    if (!hadClient) {
      if (now - startedAt >= BOOT_GRACE_MS) {
        doExit('no browser connected within boot grace')
      }
      return
    }
    if (lastBeatAt && now - lastBeatAt >= IDLE_EXIT_MS) {
      doExit('browser heartbeat lost')
    }
  }, 2000)
}
