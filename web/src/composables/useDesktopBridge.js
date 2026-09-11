import { ref, computed } from 'vue'

const detectedEnv = ref('web')
const bridgeVersion = ref('1.0.0')

export function detectDesktopEnvironment(win = typeof window !== 'undefined' ? window : {}) {
  if (!win) return 'web'
  if (win.__ACW_DESKTOP_ENV__) {
    return String(win.__ACW_DESKTOP_ENV__)
  }
  if (win.__TAURI__) {
    return 'tauri'
  }
  if (win.electron || (win.process && win.process.versions && win.process.versions.electron)) {
    return 'electron'
  }
  return 'web'
}

export function useDesktopBridge() {
  function initDesktopBridge(win = typeof window !== 'undefined' ? window : {}) {
    detectedEnv.value = detectDesktopEnvironment(win)
    return detectedEnv.value
  }

  const isDesktop = computed(() => detectedEnv.value !== 'web')
  const desktopEnv = computed(() => detectedEnv.value)

  async function notify(title, options = {}) {
    if (typeof window !== 'undefined' && window.__ACW_DESKTOP_API__?.notify) {
      return await window.__ACW_DESKTOP_API__.notify(title, options)
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      return new Notification(title, options)
    }
    return null
  }

  async function minimizeToTray() {
    if (typeof window !== 'undefined' && window.__ACW_DESKTOP_API__?.minimizeToTray) {
      return await window.__ACW_DESKTOP_API__.minimizeToTray()
    }
    return false
  }

  return {
    detectedEnv,
    bridgeVersion,
    isDesktop,
    desktopEnv,
    initDesktopBridge,
    notify,
    minimizeToTray,
  }
}
