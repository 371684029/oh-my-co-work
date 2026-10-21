/**
 * Unified input intent (5.2.0 UX-01): Enter submit, Shift+Enter newline, IME guard.
 */

export function isImeComposing(ev) {
  if (!ev) return false
  return !!(ev.isComposing || ev.keyCode === 229)
}

/** Enter should submit (not newline) when true. */
export function shouldSubmitOnEnter(ev, { pickerOpen = false } = {}) {
  if (!ev || ev.key !== 'Enter') return false
  if (ev.shiftKey || ev.ctrlKey || ev.metaKey || ev.altKey) return false
  if (isImeComposing(ev)) return false
  if (pickerOpen) return false
  return true
}

export function isHistoryNavigationKey(ev) {
  if (!ev || ev.shiftKey || ev.ctrlKey || ev.metaKey || ev.altKey) return false
  return ev.key === 'ArrowUp' || ev.key === 'ArrowDown'
}

export function historyNavigationDelta(ev) {
  if (ev?.key === 'ArrowUp') return -1
  if (ev?.key === 'ArrowDown') return 1
  return 0
}
