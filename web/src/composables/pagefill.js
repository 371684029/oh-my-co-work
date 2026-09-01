import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { exitFullscreen, fullscreenElement, requestFullscreen } from './fullscreen'

/**
 * 满屏 / 全屏 / Esc 折叠逻辑的单一来源。
 * TerminalWorkspace 与 FurnaceWorkspace 共用；差异（焦点初始值、初始满屏、
 * Esc 前额外分支）经 options 注入，行为保持不变。
 *
 * @param {import('vue').Ref} workspaceRoot 满屏/全屏的目标元素 ref
 * @param {object} [options]
 * @param {boolean} [options.initialFocused] 焦点初始值（TerminalWorkspace=true, Furnace=false）
 * @param {boolean} [options.initialPagefill] 是否初始满屏
 * @param {(ev: KeyboardEvent) => boolean} [options.onBeforeEscape] Esc 前额外分支；返回 true 表示已处理并跳过后续
 */
export function usePagefill(workspaceRoot, options = {}) {
  const { initialFocused = false, initialPagefill = false, onBeforeEscape } = options

  const isFullscreen = ref(false)
  const isPagefill = ref(initialPagefill)
  const focused = ref(initialFocused)

  function syncFullscreenState() {
    isFullscreen.value = fullscreenElement() === workspaceRoot.value
  }

  async function toggleFullscreen() {
    if (isFullscreen.value) await exitFullscreen()
    else await requestFullscreen(workspaceRoot.value)
  }

  function togglePagefill() {
    isPagefill.value = !isPagefill.value
  }

  function setFocused(value) {
    focused.value = !!value
  }

  function onKeydown(ev) {
    if (ev.key !== 'Escape') return
    if (onBeforeEscape?.(ev)) return
    if (focused.value) {
      ev.preventDefault()
      document.activeElement?.blur?.()
      focused.value = false
      return
    }
    if (isPagefill.value) {
      ev.preventDefault()
      isPagefill.value = false
    }
  }

  watch(isPagefill, async (on) => {
    document.documentElement.classList.toggle('acw-terminal-pagefill', on)
    await nextTick()
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
  })

  onMounted(() => {
    document.addEventListener('fullscreenchange', syncFullscreenState)
    document.addEventListener('keydown', onKeydown)
    syncFullscreenState()
    if (isPagefill.value) {
      document.documentElement.classList.add('acw-terminal-pagefill')
      nextTick(() => requestAnimationFrame(() => window.dispatchEvent(new Event('resize'))))
    }
  })

  onUnmounted(() => {
    document.removeEventListener('fullscreenchange', syncFullscreenState)
    document.removeEventListener('keydown', onKeydown)
    document.documentElement.classList.remove('acw-terminal-pagefill')
  })

  return {
    isFullscreen,
    isPagefill,
    focused,
    syncFullscreenState,
    toggleFullscreen,
    togglePagefill,
    setFocused,
  }
}
