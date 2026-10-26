/** Step revert confirm/apply actions for FlowRail (FE-01 extract from FlowRail.vue). */
import ElMessage from 'element-plus/es/components/message/index.mjs'
import ElMessageBox from 'element-plus/es/components/message-box/index.mjs'
import {
  flowRailRevertBlockedMessage,
  flowRailRevertConfirmButton,
  flowRailRevertConfirmMessage,
  flowRailRevertConfirmTitle,
  flowRailRevertConflictMessage,
  flowRailRevertConflictTitle,
  flowRailRevertFailedMessage,
  flowRailRevertForceButton,
  flowRailRevertForcedSuccessMessage,
  flowRailRevertSuccessMessage,
} from './flowRailFeedbackUi.js'

export function createFlowRailRevertActions({
  activeId,
  revertLoadingId,
  api,
  notify = ElMessage,
  messageBox = ElMessageBox,
}) {
  async function revertStepChanges(n) {
    const sid = activeId.value
    if (!sid || !n?.id) return
    try {
      const preview = await api.sessions.previewStepRevert(sid, n.id)
      if (!preview.ok) {
        notify.warning(flowRailRevertBlockedMessage(preview))
        return
      }
      await messageBox.confirm(flowRailRevertConfirmMessage(preview), flowRailRevertConfirmTitle(), {
        type: 'warning',
        confirmButtonText: flowRailRevertConfirmButton(preview.needsForce),
      })
      revertLoadingId.value = n.id
      await api.sessions.applyStepRevert(sid, n.id, { force: preview.needsForce })
      notify.success(flowRailRevertSuccessMessage())
    } catch (e) {
      if (e === 'cancel' || e === 'close') return
      if (e.status === 409) {
        try {
          await messageBox.confirm(
            flowRailRevertConflictMessage(e),
            flowRailRevertConflictTitle(),
            {
              type: 'warning',
              confirmButtonText: flowRailRevertForceButton(),
            },
          )
          revertLoadingId.value = n.id
          await api.sessions.applyStepRevert(sid, n.id, { force: true })
          notify.success(flowRailRevertForcedSuccessMessage())
        } catch (e2) {
          if (e2 !== 'cancel' && e2 !== 'close') notify.error(flowRailRevertFailedMessage(e2))
        } finally {
          revertLoadingId.value = ''
        }
        return
      }
      notify.error(flowRailRevertFailedMessage(e))
    } finally {
      revertLoadingId.value = ''
    }
  }

  return { revertStepChanges }
}
