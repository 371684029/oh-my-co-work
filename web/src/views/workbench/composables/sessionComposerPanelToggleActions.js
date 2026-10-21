/** Composer slash/@/# panel toggles (FE-01 extract from useSessionDetail). */
import { useComposerStore } from '../../../stores/composer.js'

export function createSessionComposerPanelToggleActions({
  readSenderText,
  readSenderTextRaw,
  appendSenderText,
  syncSlashFromInput,
  syncAtFromInput,
  syncHashFromInput,
}) {
  function toggleSlashPanel() {
    useComposerStore().atOpen = false
    useComposerStore().hashOpen = false
    useComposerStore().slashOpen = !useComposerStore().slashOpen
    if (useComposerStore().slashOpen) {
      useComposerStore().slashQuery = ''
      useComposerStore().slashIndex = 0
      appendSenderText('/')
      syncSlashFromInput()
    }
  }

  function closeComposerPanel(kind) {
    if (kind === 'slash') {
      useComposerStore().slashOpen = false
      useComposerStore().slashQuery = ''
      return
    }
    if (kind === 'at') {
      useComposerStore().atOpen = false
      useComposerStore().atQuery = ''
      return
    }
    if (kind === 'hash') {
      useComposerStore().hashOpen = false
      useComposerStore().hashQuery = ''
    }
  }

  function toggleAtPanel() {
    useComposerStore().slashOpen = false
    useComposerStore().hashOpen = false
    useComposerStore().atOpen = !useComposerStore().atOpen
    if (useComposerStore().atOpen) {
      useComposerStore().atQuery = ''
      useComposerStore().atIndex = 0
      const cur = readSenderText()
      appendSenderText(cur && !/\s$/.test(cur) ? ' @' : '@')
      syncAtFromInput()
    }
  }

  function toggleHashPanel() {
    useComposerStore().slashOpen = false
    useComposerStore().atOpen = false
    useComposerStore().hashOpen = !useComposerStore().hashOpen
    if (useComposerStore().hashOpen) {
      useComposerStore().hashQuery = ''
      useComposerStore().hashIndex = 0
      const cur = readSenderTextRaw()
      appendSenderText(cur && !/\s$/.test(cur) ? ' #' : '#')
      syncHashFromInput()
    }
  }

  return { toggleSlashPanel, closeComposerPanel, toggleAtPanel, toggleHashPanel }
}
