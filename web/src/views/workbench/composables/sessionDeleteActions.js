/** Session delete with confirm (FE-01 extract from useSessionDetail). */
import ElMessage from 'element-plus/es/components/message/index.mjs'
import { resolveSessionId } from './sessionActionUi.js'
import { shouldClearActiveSessionAfterDelete } from './sessionDeleteNavUi.js'
import {
  deleteConfirmDialogOptions,
  deleteFailedMessage,
  deleteNoSessionMessage,
  deleteSuccessMessage,
} from './sessionWorkbenchFeedbackUi.js'

export function createSessionDeleteActions({
  activeId,
  detail,
  loadLists,
  api,
  acwConfirm,
  terminalBridge,
  leaveWorkbench,
}) {
  async function doDelete(targetId) {
    const id = resolveSessionId(targetId, activeId.value)
    if (!id) {
      ElMessage.warning(deleteNoSessionMessage())
      return
    }
    const deleteOpts = deleteConfirmDialogOptions()
    const ok = await acwConfirm('session.delete', {
      ...deleteOpts,
      type: 'warning',
    })
    if (!ok) return
    const clearActive = shouldClearActiveSessionAfterDelete(id, activeId.value)
    try {
      await api.sessions.remove(id)
      await loadLists()
      if (clearActive) {
        detail.value = null
        terminalBridge.resetTerminals?.()
        terminalBridge.closeWs?.()
        activeId.value = ''
        leaveWorkbench()
      }
      ElMessage.success(deleteSuccessMessage())
    } catch (e) {
      ElMessage.error(deleteFailedMessage(e))
    }
  }

  return { doDelete }
}
