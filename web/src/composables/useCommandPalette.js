import { ref } from 'vue'

const open = ref(false)

export function useCommandPalette() {
  function show() {
    open.value = true
  }
  function hide() {
    open.value = false
  }
  function toggle() {
    open.value = !open.value
  }
  return {
    paletteOpen: open,
    showPalette: show,
    hidePalette: hide,
    togglePalette: toggle,
  }
}
