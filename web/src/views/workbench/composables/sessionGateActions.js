/** Session gate API actions (FE-01 extract from useSessionDetail). */
import ElMessage from 'element-plus/es/components/message/index.mjs'
import { buildSessionGateBody } from './sessionGateRequestUi.js'
import { gateActionToast } from './sessionGateFeedbackUi.js'
import { humanGateShouldSendAsMessage } from './sessionHumanGateRouteUi.js'
import { adapterAnsweredMessage } from './sessionWorkbenchFeedbackUi.js'

export function createSessionGateActions({
  gating,
  activeId,
  members,
  readSenderText,
  clearSender,
  loadDetail,
  sessions,
  nextIdempotencyKey,
  onSenderSubmit,
  api,
}) {
  async function refreshAfterGate() {
    await loadDetail(activeId.value)
    sessions.value = await api.sessions.list()
  }

  async function submitHuman(m) {
    if (gating.value) return
    const text = readSenderText()
    if (humanGateShouldSendAsMessage(text, members.value)) {
      await onSenderSubmit()
      return
    }
    gating.value = true
    try {
      await api.sessions.gate(
        activeId.value,
        buildSessionGateBody({
          action: 'submit',
          text,
          nodeInstanceId: m.node_instance_id,
          idempotencyKey: nextIdempotencyKey('submit', m.node_instance_id),
        }),
      )
      clearSender()
      await refreshAfterGate()
    } catch (e) {
      ElMessage.error(e.message)
    } finally {
      gating.value = false
    }
  }

  async function approveSessionStart(m) {
    if (gating.value) return
    gating.value = true
    try {
      const text = readSenderText()
      await api.sessions.gate(
        activeId.value,
        buildSessionGateBody({
          action: 'approve_start',
          text,
          nodeInstanceId: m?.node_instance_id,
          idempotencyKey: nextIdempotencyKey('approve_start', m?.node_instance_id),
        }),
      )
      clearSender()
      await refreshAfterGate()
      const toast = gateActionToast('approve_start', text)
      if (toast?.level === 'success') ElMessage.success(toast.message)
    } catch (e) {
      ElMessage.error(e.message)
    } finally {
      gating.value = false
    }
  }

  async function gate(m, action) {
    if (gating.value) return
    gating.value = true
    try {
      const text = readSenderText()
      await api.sessions.gate(
        activeId.value,
        buildSessionGateBody({
          action,
          text,
          nodeInstanceId: m?.node_instance_id,
          idempotencyKey: nextIdempotencyKey(action, m?.node_instance_id),
        }),
      )
      clearSender()
      await refreshAfterGate()
      const toast = gateActionToast(action, text)
      if (toast) {
        if (toast.level === 'success') ElMessage.success(toast.message)
        else ElMessage.info(toast.message)
      }
    } catch (e) {
      ElMessage.error(e.message)
    } finally {
      gating.value = false
    }
  }

  async function answerAdapterQuestion(m, choice, action = 'adapter_answer') {
    if (gating.value || !activeId.value) return
    gating.value = true
    try {
      const text = readSenderText()
      await api.sessions.gate(
        activeId.value,
        buildSessionGateBody({
          action,
          text,
          choice,
          questionId: m?.content?.questionId,
          nodeInstanceId: m?.node_instance_id,
          idempotencyKey: nextIdempotencyKey('adapter_answer', m?.content?.questionId),
        }),
      )
      clearSender()
      await refreshAfterGate()
      ElMessage.success(adapterAnsweredMessage())
    } catch (e) {
      ElMessage.error(e.message)
    } finally {
      gating.value = false
    }
  }

  return { submitHuman, approveSessionStart, gate, answerAdapterQuestion }
}
