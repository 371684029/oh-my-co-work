/** Manual session archive (Done) — same server path as auto archive resource release. */
import ElMessage from 'element-plus/es/components/message/index.mjs'
import { resolveSessionId } from './sessionActionUi.js'
import {
  archiveConfirmDialogOptions,
  archiveFailedMessage,
  archiveNoSessionMessage,
  archiveSuccessMessage,
} from './sessionWorkbenchFeedbackUi.js'

export function shouldShowSessionDone(session) {
  return Boolean(session?.id && session.status !== 'archived')
}

export function createSessionArchiveActions({
  activeId,
  detail,
  loadLists,
  loadDetail,
  api,
  acwConfirm,
  terminalBridge,
}) {
  async function markSessionDone(targetId) {
    const id = resolveSessionId(targetId, activeId.value)
    if (!id) {
      ElMessage.warning(archiveNoSessionMessage())
      return
    }
    if (detail.value?.session?.status === 'archived') return
    const ok = await acwConfirm('session.archive', {
      ...archiveConfirmDialogOptions(),
      type: 'info',
    })
    if (!ok) return
    try {
      await api.sessions.archive(id, { reason: 'manual' })
      terminalBridge.resetTerminals?.()
      terminalBridge.closeWs?.()
      await Promise.all([loadLists(), loadDetail(id)])
      terminalBridge.bindWs?.(id)
      ElMessage.success(archiveSuccessMessage())
    } catch (e) {
      ElMessage.error(archiveFailedMessage(e))
    }
  }

  return { markSessionDone }
}