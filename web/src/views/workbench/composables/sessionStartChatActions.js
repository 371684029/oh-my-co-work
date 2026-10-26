/** Start chat / demo flow actions (FE-01 extract from useSessionDetail). */
import ElMessage from 'element-plus/es/components/message/index.mjs'
import { t } from '../../../i18n/index.js'
import {
  parseStartTarget,
  startChatFailedMessage,
  startChatNeedTargetMessage,
  startChatSuccessMessage,
} from './sessionStartChatUi.js'
import {
  DEMO_FLOW_GROUP_TITLE,
  demoFlowLoadFailedMessage,
  demoFlowMissingMessage,
  findGroupByTitle,
} from './sessionDemoFlowUi.js'

export function createSessionStartChatActions({
  startTarget,
  startingChat,
  groups,
  loadLists,
  selectSession,
  api,
}) {
  async function startChat(opts = {}) {
    const quiet = !!(opts && typeof opts === 'object' && !(opts instanceof Event) && opts.quiet)
    const parsed = parseStartTarget(startTarget.value)
    if (!parsed) {
      ElMessage.warning(startChatNeedTargetMessage())
      return
    }
    const { kind, id } = parsed
    if (startingChat.value) return
    startingChat.value = true
    try {
      const s =
        kind === 'm:'
          ? await api.members.startSession(id, {})
          : await api.groups.startSession(id, {})
      await loadLists()
      await selectSession(s.id)
      if (!quiet) {
        ElMessage.success(startChatSuccessMessage(kind, s.reused))
      }
      return s
    } catch (e) {
      ElMessage.warning(startChatFailedMessage(e))
    } finally {
      startingChat.value = false
    }
  }

  async function startDemoChat() {
    if (startingChat.value) return
    let demo = findGroupByTitle(groups.value, DEMO_FLOW_GROUP_TITLE)
    if (!demo) {
      try {
        await loadLists()
      } catch (e) {
        ElMessage.warning(demoFlowLoadFailedMessage(e, t))
        return
      }
      demo = findGroupByTitle(groups.value, DEMO_FLOW_GROUP_TITLE)
    }
    if (!demo) {
      ElMessage.warning(demoFlowMissingMessage(t))
      return
    }
    startTarget.value = `g:${demo.id}`
    await startChat()
  }

  return { startChat, startDemoChat }
}
