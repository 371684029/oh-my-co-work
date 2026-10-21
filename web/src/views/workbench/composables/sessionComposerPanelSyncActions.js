/** Composer / @ # / slash panel sync from input (FE-01 extract from useSessionDetail). */
import { useComposerStore } from '../../../stores/composer.js'
import { composerScopeKey, saveInputDraft } from '../../../composables/inputDraftHistory.js'
import {
  applyComposerPanelPatch,
  atPanelStateFromText,
  hashPanelStateFromText,
  slashPanelStateFromText,
} from './sessionComposerSync.js'

export function createSessionComposerPanelSyncActions({
  activeId,
  readSenderText,
  readSenderTextRaw,
  hashInsertLockUntilRef,
  draftTimerRef,
}) {
  function syncSlashFromInput() {
    const text = readSenderText()
    const store = useComposerStore()
    const patch = slashPanelStateFromText(text)
    applyComposerPanelPatch(store, patch)
    if (patch.slashOpen) store.slashIndex = 0
  }

  function syncAtFromInput() {
    const text = readSenderText()
    const store = useComposerStore()
    const patch = atPanelStateFromText(text)
    if (patch) {
      applyComposerPanelPatch(store, patch)
      if (patch.atOpen) store.atIndex = 0
    }
  }

  function syncHashFromInput() {
    const text = readSenderTextRaw().replace(/\s+$/u, '')
    const store = useComposerStore()
    const patch = hashPanelStateFromText(text, {
      locked: Date.now() < hashInsertLockUntilRef.until,
    })
    if (patch) {
      applyComposerPanelPatch(store, patch)
      if (patch.hashOpen) store.hashIndex = 0
    }
  }

  function onSenderChange() {
    syncSlashFromInput()
    syncAtFromInput()
    syncHashFromInput()
    window.clearTimeout(draftTimerRef.id)
    draftTimerRef.id = window.setTimeout(() => {
      if (activeId.value) saveInputDraft(composerScopeKey(activeId.value), readSenderTextRaw())
    }, 400)
  }

  return { syncSlashFromInput, syncAtFromInput, syncHashFromInput, onSenderChange }
}
