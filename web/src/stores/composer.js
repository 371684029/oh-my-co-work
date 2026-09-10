import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useComposerStore = defineStore('composer', () => {
  const footerCollapsed = ref(false)
  const slashOpen = ref(false)
  const slashQuery = ref('')
  const slashIndex = ref(0)
  const atOpen = ref(false)
  const atQuery = ref('')
  const atIndex = ref(0)
  const hashOpen = ref(false)
  const hashQuery = ref('')
  const hashIndex = ref(0)

  return {
    footerCollapsed,
    slashOpen,
    slashQuery,
    slashIndex,
    atOpen,
    atQuery,
    atIndex,
    hashOpen,
    hashQuery,
    hashIndex,
  }
})
