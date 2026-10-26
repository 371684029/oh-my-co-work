/** Announcement MD open / refresh (FE-01 extract from useSessionDetail). */
import ElMessage from 'element-plus/es/components/message/index.mjs'
import {
  announceOpenFailedMessage,
  announceOpenedMessage,
  announceRefreshFailedMessage,
  announceRefreshedMessage,
} from './sessionWorkbenchFeedbackUi.js'

export function createSessionAnnounceActions({
  activeId,
  detail,
  announceOpenLoading,
  announceLoading,
  loadDetail,
  api,
}) {
  async function openAnnouncementMd() {
    if (!activeId.value) return
    announceOpenLoading.value = true
    try {
      const r = await api.sessions.openAnnouncement(activeId.value)
      if (r?.path && detail.value) {
        detail.value.announcement = {
          ...(detail.value.announcement || {}),
          path: r.path,
        }
      }
      ElMessage.success(announceOpenedMessage(r?.absolutePath))
    } catch (e) {
      ElMessage.warning(announceOpenFailedMessage(e))
    } finally {
      announceOpenLoading.value = false
    }
  }

  async function rebuildAnnouncement() {
    if (!activeId.value) return
    announceLoading.value = true
    try {
      await api.sessions.refreshAnnouncement(activeId.value, { modes: ['io'] })
      await loadDetail(activeId.value)
      ElMessage.success(announceRefreshedMessage())
    } catch (e) {
      ElMessage.error(announceRefreshFailedMessage(e))
    } finally {
      announceLoading.value = false
    }
  }

  return { openAnnouncementMd, rebuildAnnouncement }
}
