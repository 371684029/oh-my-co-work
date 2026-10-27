/**
 * Select-to-copy helpers (CP-03). Pure functions for unit tests; DOM-free / xterm-free.
 */

/** 是否应在选区稳定后自动复制（开关关或无选区则不复制）。 */
export function shouldCopySelection({ selectToCopy, hasSelection }) {
  return selectToCopy === true && hasSelection === true
}

/**
 * 选中即复制防抖工厂：多次 selectionChange 只在静默 delayMs 后触发一次 onCopy。
 * @param {{ delayMs?: number, onCopy: () => void, setTimeoutFn?: typeof setTimeout, clearTimeoutFn?: typeof clearTimeout }} options
 * @returns {{ schedule: () => void, cancel: () => void }}
 */
export function createSelectToCopyDebouncer({
  delayMs = 250,
  onCopy,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
} = {}) {
  let timer = null
  function cancel() {
    if (timer != null) {
      clearTimeoutFn(timer)
      timer = null
    }
  }
  function schedule() {
    cancel()
    timer = setTimeoutFn(() => {
      timer = null
      onCopy()
    }, delayMs)
  }
  return { schedule, cancel }
}
