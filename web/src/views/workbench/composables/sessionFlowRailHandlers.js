/** Flow rail skipped-group expand + history node helpers (FE-01). */
import { useFlowStore } from '../../../stores/flow.js'
import {
  isSkippedFlowGroupExpanded as isSkippedFlowGroupExpandedUi,
  nextSkippedFlowGroupExpansion,
} from './sessionFlowNavUi.js'
import { isFlowHistoryNode as isFlowHistoryNodeAt } from './sessionFlowUi.js'

export function createSessionFlowRailHandlers({ getNodes, getHistorySplitIndex }) {
  function isSkippedFlowGroupExpanded(entry) {
    return isSkippedFlowGroupExpandedUi(useFlowStore(), entry)
  }

  function toggleSkippedFlowGroup(entry) {
    useFlowStore().expandedSkippedFlowGroups = nextSkippedFlowGroupExpansion(useFlowStore(), entry)
  }

  function isFlowHistoryNode(n) {
    return isFlowHistoryNodeAt(n, getNodes(), getHistorySplitIndex())
  }

  return { isSkippedFlowGroupExpanded, toggleSkippedFlowGroup, isFlowHistoryNode }
}
