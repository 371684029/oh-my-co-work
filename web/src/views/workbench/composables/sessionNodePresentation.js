/** Flow / bubble node presentation helpers bound to current session (FE-01). */
import { stepTypeLabel as sharedStepTypeLabel } from '@acw/shared'
import { useFlowStore } from '../../../stores/flow.js'
import { isCurrentStepNode, flowNodeClass } from './sessionFlowUi.js'
import {
  isCurrentOffsiteSegment as isCurrentOffsiteSegmentNode,
  offsiteEntryLabel as offsiteEntryLabelForNode,
  offsiteInvokedLabel as offsiteInvokedLabelForNode,
} from './sessionOffsiteUi.js'
import { isPendingGateMessage } from './sessionGateUi.js'
import { roleLabel as roleLabelForMessage, shortSender as shortSenderForMessage } from './sessionMessageUi.js'
import { formatSessionIo } from './sessionFormatUtils.js'

export function createSessionNodePresentation({
  detail,
  members,
  getActiveOffsiteNodeId,
  getOffsiteMode,
}) {
  function nodeBypassed(n) {
    return !!(n?.output?.bypassed || n?.input?.bypassed)
  }

  function stepTypeLabel(t) {
    return sharedStepTypeLabel(t) || t
  }

  function roleLabel(m) {
    return roleLabelForMessage(m, members.value)
  }

  function shortSender(m, fullName) {
    return shortSenderForMessage(m, fullName, members.value)
  }

  function isPendingGate(m) {
    if (!detail.value) return false
    return isPendingGateMessage(m, detail.value.nodes)
  }

  function isCurrent(n) {
    if (!detail.value) return false
    return isCurrentStepNode(n, detail.value.session)
  }

  function isCurrentOffsiteSegment(n) {
    return isCurrentOffsiteSegmentNode(n, getActiveOffsiteNodeId())
  }

  function offsiteEntryLabel(n) {
    return offsiteEntryLabelForNode(n, {
      activeOffsiteNodeId: getActiveOffsiteNodeId(),
      mode: getOffsiteMode(),
    })
  }

  function offsiteInvokedLabel(n) {
    return offsiteInvokedLabelForNode(n)
  }

  function flowClass(n) {
    return flowNodeClass(n, detail.value?.session)
  }

  function toggleNodeExpand(n) {
    useFlowStore().expandedNodeId = useFlowStore().expandedNodeId === n.id ? null : n.id
  }

  function formatIo(val, role = 'auto') {
    return formatSessionIo(val, role)
  }

  return {
    nodeBypassed,
    stepTypeLabel,
    roleLabel,
    shortSender,
    isPendingGate,
    isCurrent,
    isCurrentOffsiteSegment,
    offsiteEntryLabel,
    offsiteInvokedLabel,
    flowClass,
    toggleNodeExpand,
    formatIo,
  }
}
