/** Turn copy actions for the furnace workspace (FE-01 extract from FurnaceWorkspace.vue). */
import ElMessage from 'element-plus/es/components/message/index.mjs'
import { furnaceTurnCopyPlain } from '@acw/shared'
import {
  furnaceTurnCopyEmptyMessage,
  furnaceTurnCopyFailedMessage,
  furnaceTurnCopySuccessMessage,
} from '../../../composables/furnaceWorkspaceCopy.js'

export function createFurnaceTurnCopyActions({ writeClipboardText, notify = ElMessage }) {
  async function copyTurn(turn) {
    const text = furnaceTurnCopyPlain(turn?.role, turn?.text)
    if (!text) {
      notify.warning(furnaceTurnCopyEmptyMessage())
      return
    }
    try {
      await writeClipboardText(text)
      notify.success(furnaceTurnCopySuccessMessage())
    } catch {
      notify.warning(furnaceTurnCopyFailedMessage())
    }
  }

  return { copyTurn }
}
