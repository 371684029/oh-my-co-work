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
  /** 闸门「是否通过」，默认勾选（5.4.1 下一步节点） */
  const gatePassChecked = ref(true)

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
    gatePassChecked,
  }
})
