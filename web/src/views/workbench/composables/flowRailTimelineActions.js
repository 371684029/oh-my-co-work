/** Timeline load / audit / terminal-replay actions for FlowRail (FE-01 extract from FlowRail.vue). */
import ElMessage from 'element-plus/es/components/message/index.mjs'
import {
  flowRailAuditExportFailedMessage,
  flowRailTerminalLogFailedMessage,
  flowRailTimelineLoadFailedMessage,
} from './flowRailFeedbackUi.js'

export function createFlowRailTimelineActions({
  activeId,
  detail,
  timelineEvents,
  timelineFilter,
  timelineLoading,
  terminalReplayOpen,
  terminalReplayText,
  terminalReplayMeta,
  flowStore,
  toggleNodeExpand,
  openNodeJournal,
  api,
  notify = ElMessage,
}) {
  async function loadSessionTimeline() {
    if (!activeId.value) {
      timelineEvents.value = []
      return
    }
    timelineLoading.value = true
    try {
      const data = await api.sessions.timeline(activeId.value, timelineFilter.value)
      timelineEvents.value = data.events || []
    } catch (e) {
      notify.error(flowRailTimelineLoadFailedMessage(e))
    } finally {
      timelineLoading.value = false
    }
  }

  async function downloadSessionAudit() {
    if (!activeId.value) return
    try {
      await api.sessions.downloadAudit(activeId.value)
    } catch (e) {
      notify.error(flowRailAuditExportFailedMessage(e))
    }
  }

  async function openTerminalReplay(terminalId) {
    if (!activeId.value || !terminalId) return
    try {
      const preview = await api.sessions.terminalLogPreview(activeId.value, terminalId)
      terminalReplayText.value = preview.text || ''
      terminalReplayMeta.value = preview
      terminalReplayOpen.value = true
    } catch (e) {
      notify.error(flowRailTerminalLogFailedMessage(e))
    }
  }

  function onTimelineEvent(ev) {
    if (!ev) return
    if (ev.category === 'terminal' && ev.terminalId) {
      openTerminalReplay(ev.terminalId)
      return
    }
    if (ev.nodeId && detail.value?.nodes) {
      const node = detail.value.nodes.find((n) => n.id === ev.nodeId)
      if (node) {
        flowStore.rightTab = 'flow'
        toggleNodeExpand(node)
        return
      }
    }
    if (ev.kind === 'docs.journal' && ev.nodeId) {
      const node = detail.value?.nodes?.find((n) => n.id === ev.nodeId)
      if (node) openNodeJournal(node)
    }
  }

  return { loadSessionTimeline, downloadSessionAudit, openTerminalReplay, onTimelineEvent }
}
