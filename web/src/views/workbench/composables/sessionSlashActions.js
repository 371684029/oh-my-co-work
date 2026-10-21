/** Slash command run handler (FE-01 extract from useSessionDetail). */
import { ElMessage, ElMessageBox } from 'element-plus'
import { extractCallArgsFromSlash, FURNACE_DISPLAY_NAME } from '@acw/shared'
import { useComposerStore } from '../../../stores/composer.js'
import {
  agentInsertTextFromSlashRun,
  slashNeedsUrlPrompt,
  slashRunSuccessMessage,
  slashUrlPromptDefault,
} from './sessionSlashRunUi.js'

export function createSessionSlashActions({
  activeId,
  readSenderTextRaw,
  clearSender,
  replaceSenderText,
  api,
}) {
  async function runSlash(cmd) {
    if (!cmd) return
    try {
      let url
      if (slashNeedsUrlPrompt(cmd)) {
        const { value } = await ElMessageBox.prompt(cmd.description || slashUrlPromptDefault(), cmd.name, {
          inputValue: cmd.url || 'https://',
        })
        url = value
      }
      const args = extractCallArgsFromSlash(readSenderTextRaw(), cmd.slash)
      const r = await api.slashCommands.run(cmd.id, {
        sessionId: activeId.value || undefined,
        url,
        args,
      })
      useComposerStore().slashOpen = false
      useComposerStore().slashQuery = ''
      if (r.kind === 'url' && r.url) {
        window.open(r.url, '_blank', 'noopener')
        clearSender()
      } else if (r.kind === 'agent') {
        await replaceSenderText(agentInsertTextFromSlashRun(r, FURNACE_DISPLAY_NAME))
      } else {
        clearSender()
      }
      ElMessage.success(slashRunSuccessMessage(r, cmd))
    } catch (e) {
      ElMessage.error(e.message)
    }
  }

  return { runSlash }
}
