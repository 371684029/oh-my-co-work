import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const RIGHT_TAB_KEY = 'acw.rightTab'

function readSavedRightTab() {
  try {
    const v = localStorage.getItem(RIGHT_TAB_KEY)
    return v === 'docs' ? 'docs' : 'flow'
  } catch {
    return 'flow'
  }
}

export const useFlowStore = defineStore('flow', () => {
  const expandedNodeId = ref(null)
  const expandedSkippedFlowGroups = ref({})
  const rightTab = ref(readSavedRightTab())
  const docsUnread = ref(0)

  watch(rightTab, (v) => {
    try {
      localStorage.setItem(RIGHT_TAB_KEY, v === 'docs' ? 'docs' : 'flow')
    } catch {
      /* ignore */
    }
  })

  function bumpDocsUnread(n = 1) {
    docsUnread.value = Math.min(99, docsUnread.value + Number(n || 1))
  }

  function clearDocsUnread() {
    docsUnread.value = 0
  }

  return {
    expandedNodeId,
    expandedSkippedFlowGroups,
    rightTab,
    docsUnread,
    bumpDocsUnread,
    clearDocsUnread,
  }
})
