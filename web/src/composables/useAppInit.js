import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '../api'
import {
  setGrokConfigured,
  setFurnaceGrokGate,
  grokCanRun,
} from './furnaceUi.js'
import { fullscreenElement } from './fullscreen'
import { useAppConfig } from './useAppConfig'
import { useDesktopBridge } from './useDesktopBridge'

export function useAppInit() {
  const { initDesktopBridge, isDesktop, desktopEnv } = useDesktopBridge()
  const isFullscreen = ref(false)
  const grokGuideOpen = ref(false)
  const grokGuideStatus = ref({})
  const grokExampleToml = ref('')

  const { startupUpdateCheck, loadConfig } = useAppConfig()

  const grokCanContinue = computed(() => grokCanRun(grokGuideStatus.value))

  function syncFullscreenState() {
    isFullscreen.value = !!fullscreenElement()
  }

  async function refreshGrokGate() {
    try {
      const [s, probe] = await Promise.all([api.appSettings.get(), api.grok.status()])
      grokGuideStatus.value = probe
      grokExampleToml.value = probe.exampleToml || ''
      setFurnaceGrokGate({ probe })
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

  // 4.7.0 启动时检查更新（静默，仅发现新版本时轻提示）
  async function startupCheckUpdate() {
    try {
      const s = await loadConfig()
      if (!s || startupUpdateCheck.value === false) return
      const r = await api.update.check()
      if (!r.checked || !r.hasUpdate) return
      ElMessage.info({
        message: `发现新版本 v${r.latest}，前往设置 → 关于查看详情`,
        duration: 8000,
      })
    } catch {
      // 静默失败，不打扰用户
    }
  }

  onMounted(() => {
    initDesktopBridge()
    document.addEventListener('fullscreenchange', syncFullscreenState)
    syncFullscreenState()
    refreshGrokGate()
    startupCheckUpdate()
  })

  onUnmounted(() => {
    document.removeEventListener('fullscreenchange', syncFullscreenState)
  })

  return {
    isFullscreen,
    isDesktop,
    desktopEnv,
    grokGuideOpen,
    grokGuideStatus,
    grokExampleToml,
    grokCanContinue,
    refreshGrokGate,
    ensureFurnaceGrokWired,
  }
}
