/** Session notes save (FE-01 extract from useSessionDetail). */
import ElMessage from 'element-plus/es/components/message/index.mjs'
import {
  sessionNotesSaveFailedMessage,
  sessionNotesSavedMessage,
} from './sessionWorkbenchFeedbackUi.js'

export function createSessionNotesActions({
  activeId,
  sessionNotesDraft,
  detail,
  notesSaving,
  api,
}) {
  async function saveSessionNotes() {
    if (!activeId.value) return
    notesSaving.value = true
    try {
      const r = await api.sessions.saveNotes(activeId.value, sessionNotesDraft.value)
      sessionNotesDraft.value = r.notes ?? sessionNotesDraft.value
      if (detail.value?.session) {
        detail.value.session.context = {
          ...(detail.value.session.context || {}),
          notes: sessionNotesDraft.value,
        }
      }
      ElMessage.success(sessionNotesSavedMessage())
    } catch (e) {
      ElMessage.error(sessionNotesSaveFailedMessage(e))
    } finally {
      notesSaving.value = false
    }
  }

  return { saveSessionNotes }
}
