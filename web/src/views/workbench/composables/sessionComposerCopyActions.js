/** Composer copy-to-clipboard (FE-01 extract from useSessionDetail). */
import ElMessage from 'element-plus/es/components/message/index.mjs'
import {
  composerCopyFailedMessage,
  composerCopySuccessMessage,
  composerEmptyMessage,
} from './sessionWorkbenchFeedbackUi.js'

export function createSessionComposerCopyActions({ readSenderText }) {
  async function copyComposerText() {
    const text = readSenderText()
    if (!text) {
      ElMessage.warning(composerEmptyMessage())
      return
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      ElMessage.success(composerCopySuccessMessage())
    } catch (e) {
      ElMessage.warning(composerCopyFailedMessage(e))
    }
  }

  return { copyComposerText }
}
