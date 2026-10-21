/** Session title rename (FE-01 extract from useSessionDetail). */
import { ElMessage } from 'element-plus'

export function createSessionRenameActions({ activeId, editTitle, sessions, api }) {
  async function rename() {
    if (!activeId.value || !editTitle.value.trim()) return
    try {
      await api.sessions.rename(activeId.value, editTitle.value.trim())
      sessions.value = await api.sessions.list()
    } catch (e) {
      ElMessage.error(e.message)
    }
  }

  return { rename }
}
