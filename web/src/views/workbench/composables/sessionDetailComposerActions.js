/**
 * Composer action wiring (FE-01/ENG-04 extract from useSessionDetail.js).
 * 装配 copy / 面板同步 / 面板开关 / 插入 / slash / 键盘 动作。
 */
import { createSessionComposerCopyActions } from './sessionComposerCopyActions.js'
import { createSessionComposerPanelSyncActions } from './sessionComposerPanelSyncActions.js'
import { createSessionComposerPanelToggleActions } from './sessionComposerPanelToggleActions.js'
import { createSessionComposerInsertActions } from './sessionComposerInsertActions.js'
import { createSessionSlashActions } from './sessionSlashActions.js'
import { createSessionComposerKeydownActions } from './sessionComposerKeydownActions.js'

export function createSessionDetailComposerActions({
  activeId,
  api,
  readSenderText,
  readSenderTextRaw,
  replaceSenderText,
  appendSenderText,
  clearSender,
  hashInsertLockUntilRef,
  composerDraftTimerRef,
  composerHistIndexRef,
  filteredSlashCmds,
  filteredAtMembers,
  filteredHashItems,
}) {
  const { copyComposerText } = createSessionComposerCopyActions({ readSenderText })

  const { syncSlashFromInput, syncAtFromInput, syncHashFromInput, onSenderChange } =
    createSessionComposerPanelSyncActions({
      activeId,
      readSenderText,
      readSenderTextRaw,
      hashInsertLockUntilRef,
      draftTimerRef: composerDraftTimerRef,
    })

  const { toggleSlashPanel, closeComposerPanel, toggleAtPanel, toggleHashPanel } =
    createSessionComposerPanelToggleActions({
      readSenderText,
      readSenderTextRaw,
      appendSenderText,
      syncSlashFromInput,
      syncAtFromInput,
      syncHashFromInput,
    })

  const { insertAtMember, insertHashItem } = createSessionComposerInsertActions({
    readSenderText,
    readSenderTextRaw,
    replaceSenderText,
  })

  const { runSlash } = createSessionSlashActions({
    activeId,
    readSenderTextRaw,
    clearSender,
    replaceSenderText,
    api,
  })

  const { onComposerKeydown } = createSessionComposerKeydownActions({
    activeId,
    readSenderText,
    readSenderTextRaw,
    replaceSenderText,
    composerHistIndexRef,
    filteredHashItems,
    filteredAtMembers,
    filteredSlashCmds,
    syncSlashFromInput,
    syncAtFromInput,
    syncHashFromInput,
    insertAtMember,
    insertHashItem,
    runSlash,
  })

  return {
    copyComposerText,
    syncSlashFromInput,
    syncAtFromInput,
    syncHashFromInput,
    onSenderChange,
    toggleSlashPanel,
    closeComposerPanel,
    toggleAtPanel,
    toggleHashPanel,
    insertAtMember,
    insertHashItem,
    runSlash,
    onComposerKeydown,
  }
}
