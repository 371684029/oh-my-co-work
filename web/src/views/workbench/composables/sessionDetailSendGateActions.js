/**
 * Message send + gate wiring (FE-01/ENG-04 extract from useSessionDetail.js).
 * 顺序敏感：onSenderSubmit（消息发送）先于闸门动作创建——其 submitHuman 读
 * gateActionsRef.submitHuman，该方法在 createSessionGateActions + Object.assign
 * 之后才存在（两段式接线保持原序，勿调换）。
 */
import { createSessionMessageSendActions } from './sessionMessageSendActions.js'
import { createSessionGateActions } from './sessionGateActions.js'
import { nextGateIdempotencyKey } from './sessionGateIdempotency.js'

export function createSessionDetailSendGateActions({
  sending,
  uploading,
  gating,
  activeId,
  sessions,
  members,
  slashCommands,
  pendingFiles,
  pendingGate,
  filteredSlashCmds,
  readSenderText,
  clearSender,
  loadLists,
  selectSession,
  loadDetail,
  runSlash,
  composerHistIndexRef,
  gateActionsRef,
  api,
}) {
  const { onSenderSubmit } = createSessionMessageSendActions({
    sending,
    uploading,
    readSenderText,
    pendingGate,
    members,
    slashCommands,
    filteredSlashCmds,
    activeId,
    pendingFiles,
    clearSender,
    loadLists,
    selectSession,
    loadDetail,
    sessions,
    runSlash,
    submitHuman: (m) => gateActionsRef.submitHuman(m),
    api,
    composerHistIndexRef,
  })

  const nextIdempotencyKey = nextGateIdempotencyKey

  const { submitHuman, approveSessionStart, gate, answerAdapterQuestion } = createSessionGateActions({
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
  })
  Object.assign(gateActionsRef, { submitHuman, approveSessionStart, gate, answerAdapterQuestion })

  return { onSenderSubmit, submitHuman, approveSessionStart, gate, answerAdapterQuestion, nextIdempotencyKey }
}
