import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useFlowStore = defineStore('flow', () => {
  const expandedNodeId = ref(null)
  const expandedSkippedFlowGroups = ref({})
  const rightTab = ref('flow')

  return {
    expandedNodeId,
    expandedSkippedFlowGroups,
    rightTab,
  }
})
