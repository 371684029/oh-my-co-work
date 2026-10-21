/** Composer keydown: history nav + @/#/ slash pickers (FE-01 extract from useSessionDetail). */
import { useComposerStore } from '../../../stores/composer.js'
import {
  composerScopeKey,
  stepInputHistory,
} from '../../../composables/inputDraftHistory.js'
import { historyNavigationDelta, isHistoryNavigationKey } from '../../../composables/inputIntent.js'
import { handleComposerPickerListKeydown } from './sessionComposerKeydownUi.js'

export function createSessionComposerKeydownActions({
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
}) {
  function onComposerKeydown(e) {
    const pickerOpen =
      useComposerStore().hashOpen || useComposerStore().atOpen || useComposerStore().slashOpen
    if (
      !pickerOpen &&
      isHistoryNavigationKey(e) &&
      activeId.value &&
      !readSenderTextRaw().trim()
    ) {
      const delta = historyNavigationDelta(e)
      const step = stepInputHistory(composerScopeKey(activeId.value), {
        index: composerHistIndexRef.index,
        delta,
      })
      if (step) {
        e.preventDefault()
        composerHistIndexRef.index = step.index
        void replaceSenderText(step.text)
        return
      }
    }

    const store = useComposerStore()

    if (store.hashOpen) {
      const list = filteredHashItems.value
      if (
        handleComposerPickerListKeydown(e, {
          listLength: list.length,
          index: store.hashIndex,
          setIndex: (i) => {
            store.hashIndex = i
          },
          onPick: () => insertHashItem(list[store.hashIndex] || list[0]),
          onClose: () => {
            store.hashOpen = false
          },
        })
      ) {
        return
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        setTimeout(() => {
          syncHashFromInput()
          syncAtFromInput()
          syncSlashFromInput()
        }, 0)
      }
    }

    if (store.atOpen) {
      const members = filteredAtMembers.value
      if (
        handleComposerPickerListKeydown(e, {
          listLength: members.length,
          index: store.atIndex,
          setIndex: (i) => {
            store.atIndex = i
          },
          onPick: () => insertAtMember(members[store.atIndex] || members[0]),
          onClose: () => {
            store.atOpen = false
          },
        })
      ) {
        return
      }
    }

    if (!store.slashOpen) {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setTimeout(syncSlashFromInput, 0)
      }
      if (e.key === '@' && !e.ctrlKey && !e.metaKey) {
        setTimeout(syncAtFromInput, 0)
      }
      if (e.key === '#' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setTimeout(syncHashFromInput, 0)
      }
      return
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      setTimeout(() => {
        syncSlashFromInput()
        syncAtFromInput()
        syncHashFromInput()
      }, 0)
    }
    const list = filteredSlashCmds.value
    if (
      handleComposerPickerListKeydown(e, {
        listLength: list.length,
        index: store.slashIndex,
        setIndex: (i) => {
          store.slashIndex = i
        },
        onPick: () => runSlash(list[store.slashIndex] || list[0]),
        onClose: () => {
          store.slashOpen = false
        },
        selectOnTab: false,
        enterRequiresSlashPrefix: true,
        readSenderText,
      })
    ) {
      return
    }
  }

  return { onComposerKeydown }
}
