import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const RIGHT_TAB_KEY = 'acw.rightTab'

function readSavedRightTab() {
  try {
    const v = localStorage.getItem(RIGHT_TAB_KEY)
    if (v === 'docs' || v === 'timeline') return v
    return 'flow'
  } catch {
    return 'flow'
  }
}

export const useFlowStore = defineStore('flow', () => {
  const expandedNodeId = ref(null)
  const expandedSkippedFlowGroups = ref({})
  const rightTab = ref(readSavedRightTab())
  const docsUnread = ref(0)
  const actionUnread = ref(0)
  /** Bumps when UI should open a doc in the right rail (DOC-18). */
  const railDocFocus = ref(null)
  const docsNotifySeq = ref(0)

  watch(rightTab, (v) => {
    try {
      localStorage.setItem(RIGHT_TAB_KEY, v === 'docs' || v === 'timeline' ? v : 'flow')
    } catch {
      /* ignore */
    }
  })

  function bumpDocsUnread(n = 1) {
    docsUnread.value = Math.min(99, docsUnread.value + Number(n || 1))
    docsNotifySeq.value += 1
  }

  function focusRailDoc(sessionId, name) {
    if (!sessionId || !name) return
    rightTab.value = 'docs'
    railDocFocus.value = { sessionId, name, token: Date.now() }
  }

  function clearDocsUnread() {
    docsUnread.value = 0
  }

  function bumpActionUnread(n = 1) {
    actionUnread.value = Math.min(99, actionUnread.value + Number(n || 1))
  }

  function clearActionUnread() {
    actionUnread.value = 0
  }

  return {
    expandedNodeId,
    expandedSkippedFlowGroups,
    rightTab,
    docsUnread,
    actionUnread,
    bumpDocsUnread,
    clearDocsUnread,
    bumpActionUnread,
    clearActionUnread,
    railDocFocus,
    docsNotifySeq,
    focusRailDoc,
  }
})
