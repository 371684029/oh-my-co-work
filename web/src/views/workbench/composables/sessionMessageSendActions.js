/** Composer message send / submit routing (FE-01 extract from useSessionDetail). */
import ElMessage from 'element-plus/es/components/message/index.mjs'
import { useComposerStore } from '../../../stores/composer.js'
import {
  composerScopeKey,
  pushInputHistory,
  saveInputDraft,
} from '../../../composables/inputDraftHistory.js'
import { composerSubmitRoute, pickSlashCommandOnSubmit } from './sessionSenderSubmitUi.js'
import { slashCommandNotFoundMessage } from './sessionSlashRunUi.js'
import { composerMentionAssistOnly } from './sessionMentionAssistUi.js'
import {
  messageSendMentionFeedback,
  messageSendNewSessionId,
  shouldRefreshCurrentSessionAfterSend,
} from './sessionMessageSendUi.js'
import {
  mainGateWaitingInfoMessage,
  mentionPendingSuccessMessage,
  needSelectSessionMessage,
  newTaskCreatedMessage,
} from './sessionMessageFeedbackUi.js'

export function createSessionMessageSendActions({
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
  submitHuman,
  api,
  composerHistIndexRef,
}) {
  async function onSenderSubmit() {
    if (sending.value || uploading.value) return
    const text = readSenderText()
    const atts = [...pendingFiles.value]
    const g = pendingGate.value
    const mentionAssist = composerMentionAssistOnly(text, members.value)
    const route = composerSubmitRoute({
      text,
      gate: g,
      mentionAssistOnly: mentionAssist,
      attachmentsCount: atts.length,
    })

    if (route === 'slash') {
      const slashCmd = pickSlashCommandOnSubmit(
        text,
        slashCommands.value,
        filteredSlashCmds.value[useComposerStore().slashIndex],
      )
      if (slashCmd) {
        await runSlash(slashCmd)
        return
      }
      const token = text.slice(1).trim().split(/\s+/)[0] || ''
      ElMessage.warning(slashCommandNotFoundMessage(token))
      return
    }

    if (route === 'human_gate') {
      await submitHuman(g)
      return
    }

    if (route === 'noop') return

    pushInputHistory(composerScopeKey(activeId.value), text)
    composerHistIndexRef.index = -1
    saveInputDraft(composerScopeKey(activeId.value), '')

    if (!activeId.value) {
      ElMessage.warning(needSelectSessionMessage())
      return
    }
    sending.value = true
    try {
      const r = await api.sessions.message(activeId.value, text, atts)
      clearSender()
      pendingFiles.value = []
      const mention = messageSendMentionFeedback(r)
      if (mention) {
        ElMessage.success(mentionPendingSuccessMessage(mention.offsiteMode))
        if (mention.mainGateWaiting) {
          ElMessage.info(mainGateWaitingInfoMessage())
        }
      }
      const newSid = messageSendNewSessionId(r)
      if (newSid) {
        await loadLists()
        await selectSession(newSid)
        ElMessage.success(newTaskCreatedMessage())
      } else if (shouldRefreshCurrentSessionAfterSend(r)) {
        await loadDetail(activeId.value)
        sessions.value = await api.sessions.list()
      }
    } catch (e) {
      ElMessage.error(e.message)
    } finally {
      sending.value = false
    }
  }

  return { onSenderSubmit }
}
