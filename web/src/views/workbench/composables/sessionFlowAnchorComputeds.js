/** Flow rail entries, history split, anchor id + scroll (FE-01). */
import { computed } from 'vue'
import { useFlowStore } from '../../../stores/flow.js'
import {
  buildFlowEntries,
  computeFlowHistorySplitIndex,
  pickFlowAnchorNodeId,
} from './sessionFlowUi.js'
import { createFlowScrollToAnchor } from './sessionFlowScrollUi.js'
import { createSessionFlowRailHandlers } from './sessionFlowRailHandlers.js'

export function createSessionFlowAnchorComputeds({
  detail,
  getActiveOffsiteId,
  flowScrollTimerRef,
}) {
  const flowEntries = computed(() =>
    buildFlowEntries(detail.value?.nodes, detail.value?.session),
  )

  const flowHistorySplitIndex = computed(() =>
    computeFlowHistorySplitIndex(detail.value?.nodes, detail.value?.session),
  )

  const flowAnchorNodeId = computed(() =>
    pickFlowAnchorNodeId(detail.value?.nodes, detail.value?.session, {
      activeOffsiteId: getActiveOffsiteId(),
    }),
  )

  const { scrollFlowToAnchor, clearFlowScrollTimer } = createFlowScrollToAnchor({
    getAnchorNodeId: () => flowAnchorNodeId.value,
    isFlowTabActive: () => useFlowStore().rightTab === 'flow',
    timerRef: flowScrollTimerRef,
  })

  const { isSkippedFlowGroupExpanded, toggleSkippedFlowGroup, isFlowHistoryNode } =
    createSessionFlowRailHandlers({
      getNodes: () => detail.value?.nodes,
      getHistorySplitIndex: () => flowHistorySplitIndex.value,
    })

  return {
    flowEntries,
    flowHistorySplitIndex,
    flowAnchorNodeId,
    scrollFlowToAnchor,
    clearFlowScrollTimer,
    isSkippedFlowGroupExpanded,
    toggleSkippedFlowGroup,
    isFlowHistoryNode,
  }
}
