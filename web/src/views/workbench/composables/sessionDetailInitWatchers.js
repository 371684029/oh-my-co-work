/** initSessionDetail watcher registration (FE-01). */
import { watch } from 'vue'
import { useComposerStore } from '../../../stores/composer.js'
import { useFlowStore } from '../../../stores/flow.js'

export function registerSessionDetailWatchers({
  stopWatchers,
  pendingGate,
  activeId,
  detail,
  selectSession,
  flowAnchorNodeId,
  scrollFlowToAnchor,
}) {
  stopWatchers.push(
    watch(pendingGate, (g) => {
      if (g) useComposerStore().footerCollapsed = false
    }),
  )

  stopWatchers.push(
    watch(activeId, (id, prev) => {
      if (id && id !== prev && (!detail.value || detail.value.session.id !== id)) {
        selectSession(id)
      }
    }),
  )

  stopWatchers.push(
    watch(
      [flowAnchorNodeId, () => useFlowStore().rightTab, () => detail.value?.nodes?.length],
      () => {
        scrollFlowToAnchor()
      },
    ),
  )
}
