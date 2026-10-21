import { ref, computed, h, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '../api'
import router from '../router'
import {
  setGrokConfigured,
  setFurnaceGrokGate,
  grokCanRun,
} from './furnaceUi.js'
import { fullscreenElement } from './fullscreen'
import { useDesktopBridge } from './useDesktopBridge.js'
import { loadNotificationPrefs } from './useNotificationPrefs.js'
import { syncTrayStatus } from './syncTrayStatus.js'
import { markInboxHandled } from './notificationInbox.js'
import {
  applyColorScheme,
  normalizeColorScheme,
  readStoredColorScheme,
  watchSystemColorScheme,
  writeStoredColorScheme,
} from './uiColorScheme.js'

export function useAppInit() {
  const desktop = useDesktopBridge()
  const isFullscreen = ref(false)
  const grokGuideOpen = ref(false)
  const grokGuideStatus = ref({})
  const grokExampleToml = ref('')

  const grokCanContinue = computed(() => grokCanRun(grokGuideStatus.value))
  const reduceEffects = ref(false)
  const colorSchemePref = ref(readStoredColorScheme())
  let stopSystemThemeWatch = null

  function applyUiSettings(settings) {
    reduceEffects.value = !!settings?.ui?.reduceEffects
    const scheme = normalizeColorScheme(settings?.ui?.colorScheme || readStoredColorScheme())
    colorSchemePref.value = scheme
    writeStoredColorScheme(scheme)
    applyColorScheme(scheme)
    stopSystemThemeWatch?.()
    stopSystemThemeWatch = watchSystemColorScheme(() => {
      if (colorSchemePref.value === 'system') applyColorScheme('system')
    })
  }

  function syncFullscreenState() {
    isFullscreen.value = !!fullscreenElement()
  }

  async function refreshGrokGate() {
    try {
      const [s, probe] = await Promise.all([api.appSettings.get(), api.grok.status()])
      grokGuideStatus.value = probe
      grokExampleToml.value = probe.exampleToml || ''
      setFurnaceGrokGate({ probe })
      applyUiSettings(s)
      return { s, probe }
    } catch {
      setGrokConfigured(false)
      return { s: null, probe: null }
    }
  }

  /** 本机已能跑 Grok 时，把熔炉成员接到 grok 命令，否则只开聊天回声 */
  async function ensureFurnaceGrokWired(s, probe) {
    if (!grokCanRun(probe) || s?.grok?.configured) return s
    try {
      const next = await api.appSettings.update({
        grok: {
          command: s?.grok?.command || probe?.command || 'grok',
          configured: true,
        },
      })
      setFurnaceGrokGate({ probe })
      return next
    } catch {
      return s
    }
  }

  // 4.7.0 启动时检查更新（静默，仅发现新版本时轻提示；可点进关于页）
  async function startupCheckUpdate(settings) {
    try {
      const s = settings && typeof settings === 'object' ? settings : await api.appSettings.get()
      if (!s || s.updateCheck?.startup === false) return
      const r = await api.update.check()
      if (!r.checked || !r.hasUpdate) return
      const rawNotes = String(r.notes || '').replace(/\s+/g, ' ').trim()
      const notesPreview = rawNotes.slice(0, 80)
      ElMessage({
        type: 'info',
        duration: 8000,
        showClose: true,
        message: h('span', { style: 'line-height:1.45' }, [
          `发现新版本 v${r.latest}`,
          notesPreview ? `：${notesPreview}${rawNotes.length > 80 ? '…' : ''}` : '',
          ' · ',
          h(
            'button',
            {
              type: 'button',
              style:
                'padding:0;border:0;background:none;color:#409eff;cursor:pointer;text-decoration:underline;font:inherit',
              onClick: () => {
                router.push('/settings/about')
              },
            },
            '前往关于查看详情',
          ),
        ]),
      })
    } catch {
      // 静默失败，不打扰用户
    }
  }

  const clearTrayOnFocus = () => syncTrayStatus({ pending: 0, status: 'idle' })

  onMounted(() => {
    desktop.initDesktopBridge()
    window.__ACW_DESKTOP_API__?.onNotificationAction?.(({ id, action }) => {
      if (id) markInboxHandled(id, action || 'click')
    })
    applyColorScheme(colorSchemePref.value)
    stopSystemThemeWatch = watchSystemColorScheme(() => {
      if (colorSchemePref.value === 'system') applyColorScheme('system')
    })
    document.addEventListener('fullscreenchange', syncFullscreenState)
    window.addEventListener('focus', clearTrayOnFocus)
    syncFullscreenState()
    void loadNotificationPrefs()
    refreshGrokGate().then(({ s }) => startupCheckUpdate(s))
  })

  onUnmounted(() => {
    stopSystemThemeWatch?.()
    stopSystemThemeWatch = null
    document.removeEventListener('fullscreenchange', syncFullscreenState)
    window.removeEventListener('focus', clearTrayOnFocus)
  })

  return {
    isFullscreen,
    grokGuideOpen,
    grokGuideStatus,
    grokExampleToml,
    grokCanContinue,
    refreshGrokGate,
    ensureFurnaceGrokWired,
    reduceEffects,
    colorSchemePref,
    isDesktop: desktop.isDesktop,
    desktopEnv: desktop.desktopEnv,
  }
}
