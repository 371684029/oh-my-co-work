/** Flow restart-from-node API action (FE-01 extract from useSessionDetail). */
import { ElMessage } from 'element-plus'
import { useComposerStore } from '../../../stores/composer.js'
import { useFlowStore } from '../../../stores/flow.js'
import {
  restartArchiveBlockedMessage,
  restartFromNodeSuccessMessage,
  restartOffsiteBlockedMessage,
} from './sessionFlowRestartUi.js'

export function createSessionRestartActions({
  activeId,
  detail,
  gating,
  sessions,
  offsiteActive,
  loadDetail,
  api,
  scrollFlowToAnchor,
}) {
  async function restartFromNode(n) {
    if (!n || !activeId.value) return
    if (n.step_type === 'offsite') {
      ElMessage.warning(restartOffsiteBlockedMessage())
      return
    }
    if (n.step_type === 'archive') {
      ElMessage.warning(restartArchiveBlockedMessage())
      return
    }
    if (gating.value) return
    const wasOffsite = offsiteActive.value
    const wasArchived = detail.value?.session?.status === 'archived'
    gating.value = true
    try {
      const r = await api.sessions.restartFromNode(activeId.value, {
        nodeInstanceId: n.id,
        stepIndex: n.step_index,
      })
      useFlowStore().rightTab = 'flow'
      useComposerStore().footerCollapsed = false
      await loadDetail(activeId.value)
      sessions.value = await api.sessions.list()
      const focusId = r.nodeInstanceId || n.id
      useFlowStore().expandedNodeId = focusId
      scrollFlowToAnchor()
      const title = r.title || n.title || `步骤 ${n.step_index + 1}`
      ElMessage.success(
        restartFromNodeSuccessMessage({
          title,
          forwardJump: r.forwardJump,
          wasArchived,
          wasOffsite,
          offsiteArchived: r.offsiteArchived,
        }),
      )
    } catch {
      /* business errors surfaced by API */
    } finally {
      gating.value = false
    }
  }

  return { restartFromNode }
}
