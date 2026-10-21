/** Pending gate, bubble list, announce/composer derived state (FE-01). */
import { computed } from 'vue'
import { formatBusinessIo } from '@acw/shared'
import { archiveOutcomeOf } from './sessionListUi.js'
import {
  mapMessageToBubbleItem,
  mapTerminalToBubbleItem,
  mergeBubbleRowsByTime,
  shouldHideMessageFromBubbleList,
} from './sessionBubbleListUi.js'
import { mapAnnounceProgressNode } from './sessionAnnounceUi.js'
import { findPendingGateMessage } from './sessionPendingGate.js'
import { isArchiveStatusMessage } from './sessionBubbleUi.js'
import { parseSessionContext, footerCollapsedHintForPendingGate } from './sessionContextUi.js'
import {
  computeNeedsHuman,
  announceKickoffFromContext,
  announceUserNotesFromContext,
} from './sessionAttentionUi.js'
import {
  composerFooterHintForGate,
  composerPlaceholderForGate,
  composerToolbarHintForGate,
  showComposerHintIForGate,
} from './sessionComposerUi.js'

export function createSessionGateAndBubbleComputeds({
  detail,
  terminalBridge,
  messageText,
  roleLabel,
  shortSender,
  isPendingGate,
  statusLabel,
}) {
  function isArchiveMessage(m) {
    return isArchiveStatusMessage(m, messageText(m))
  }

  const bubbleList = computed(() => {
    if (!detail.value?.messages) return []
    const bubbleDeps = { messageText, roleLabel, shortSender, isArchiveMessage }
    const messages = detail.value.messages
      .filter((m) => !shouldHideMessageFromBubbleList(m, isArchiveMessage))
      .map((m) => mapMessageToBubbleItem(m, bubbleDeps))
    const terminals = (terminalBridge.terminalSessions?.value || []).map(mapTerminalToBubbleItem)
    return mergeBubbleRowsByTime(messages, terminals)
  })

  const pendingGate = computed(() => {
    if (!detail.value) return null
    return findPendingGateMessage(
      detail.value.session,
      detail.value.messages,
      detail.value.nodes,
      isPendingGate,
    )
  })

  const footerCollapsedHint = computed(() =>
    footerCollapsedHintForPendingGate(pendingGate.value),
  )

  const needsHuman = computed(() =>
    computeNeedsHuman(detail.value?.session, pendingGate.value),
  )

  const archiveOutcomeTag = computed(() => {
    if (!detail.value?.session) return null
    const o = archiveOutcomeOf(detail.value.session, detail.value.nodes)
    if (!o) return null
    if (o === 'failed') return { label: '失败', type: 'danger', ok: false }
    return { label: '成功', type: 'success', ok: true }
  })

  const announceKickoff = computed(() =>
    announceKickoffFromContext(parseSessionContext(detail.value?.session)),
  )

  const announceUserNotes = computed(() =>
    announceUserNotesFromContext(parseSessionContext(detail.value?.session)),
  )

  const announceProgress = computed(() => {
    const nodes = detail.value?.nodes || []
    return nodes.map((n) =>
      mapAnnounceProgressNode(n, {
        formatIo: formatBusinessIo,
        statusLabel,
      }),
    )
  })

  const composerPlaceholder = computed(() => composerPlaceholderForGate(pendingGate.value))
  const composerToolbarHint = computed(() => composerToolbarHintForGate(pendingGate.value))
  const showComposerHintI = computed(() => showComposerHintIForGate(pendingGate.value))
  const composerFooterHint = computed(() => composerFooterHintForGate(pendingGate.value))

  return {
    bubbleList,
    pendingGate,
    footerCollapsedHint,
    needsHuman,
    archiveOutcomeTag,
    announceKickoff,
    announceUserNotes,
    announceProgress,
    composerPlaceholder,
    composerToolbarHint,
    showComposerHintI,
    composerFooterHint,
  }
}
