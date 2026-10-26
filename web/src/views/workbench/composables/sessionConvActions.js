/** Session list pin / conv context menu (FE-01 extract from useSessionDetail). */
import ElMessage from 'element-plus/es/components/message/index.mjs'
import ElMessageBox from 'element-plus/es/components/message-box/index.mjs'
import {
  convMenuActionFromCommand,
  normalizeMenuCommand,
  sessionIdFromConvItem,
} from './sessionConvMenuUi.js'
import {
  convRenamePromptOptions,
  convRenamedMessage,
  convUnrecognizedSessionMessage,
} from './sessionWorkbenchFeedbackUi.js'
import {
  sessionPinFailedMessage,
  sessionPinSuccessMessage,
} from './sessionPinFeedbackUi.js'

export function createSessionConvActions({
  sessions,
  detail,
  activeId,
  editTitle,
  loadDetail,
  api,
  deleteSessionRef,
}) {
  async function togglePin(id, pinned) {
    if (!id) return
    try {
      const s = await api.sessions.pin(id, pinned)
      sessions.value = await api.sessions.list()
      if (detail.value?.session?.id === id) {
        detail.value = {
          ...detail.value,
          session: { ...detail.value.session, pinned: !!s?.pinned },
        }
      }
      ElMessage.success(sessionPinSuccessMessage(pinned))
    } catch (e) {
      ElMessage.error(sessionPinFailedMessage(e))
    }
  }

  async function onConvMenu(command, item) {
    const cmd = normalizeMenuCommand(command)
    const action = convMenuActionFromCommand(cmd)
    const id = sessionIdFromConvItem(item)
    if (!id) {
      ElMessage.warning(convUnrecognizedSessionMessage())
      return
    }
    if (action === 'pin') {
      await togglePin(id, true)
      return
    }
    if (action === 'unpin') {
      await togglePin(id, false)
      return
    }
    if (action === 'delete') {
      await deleteSessionRef.doDelete(id)
      return
    }
    if (action === 'rename') {
      try {
        const current =
          sessions.value.find((s) => s.id === id)?.title ||
          (detail.value?.session?.id === id ? detail.value.session.title : '') ||
          ''
        const renameOpts = convRenamePromptOptions(current)
        const { value } = await ElMessageBox.prompt(renameOpts.message, renameOpts.title, {
          inputValue: renameOpts.inputValue,
          confirmButtonText: renameOpts.confirmButtonText,
          cancelButtonText: renameOpts.cancelButtonText,
        })
        if (value?.trim()) {
          await api.sessions.rename(id, value.trim())
          if (activeId.value === id) editTitle.value = value.trim()
          sessions.value = await api.sessions.list()
          if (detail.value?.session?.id === id) await loadDetail(id)
          ElMessage.success(convRenamedMessage())
        }
      } catch {
        /* cancelled */
      }
    }
  }

  return { togglePin, onConvMenu }
}
