import { ref } from 'vue'
import { api } from '../api'

const startupUpdateCheck = ref(true)
const appSettings = ref(null)
const loading = ref(false)

export function useAppConfig() {
  async function loadConfig() {
    loading.value = true
    try {
      const s = await api.appSettings.get()
      appSettings.value = s
      startupUpdateCheck.value = s?.updateCheck?.startup !== false
      return s
    } catch {
      return null
    } finally {
      loading.value = false
    }
  }

  async function setStartupUpdateCheck(enabled) {
    startupUpdateCheck.value = !!enabled
    try {
      const updated = await api.appSettings.update({
        updateCheck: { startup: !!enabled },
      })
      appSettings.value = updated
      return updated
    } catch (e) {
      // 回滚状态
      if (appSettings.value) {
        startupUpdateCheck.value = appSettings.value?.updateCheck?.startup !== false
      } else {
        startupUpdateCheck.value = !enabled
      }
      throw e
    }
  }

  return {
    startupUpdateCheck,
    appSettings,
    loading,
    loadConfig,
    setStartupUpdateCheck,
  }
}
