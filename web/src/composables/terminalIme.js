/**
 * IME / composition guards for terminal input (5.2.0 CP-18).
 */

export function isImeComposingEvent(ev) {
  if (!ev) return false
  return !!(ev.isComposing || ev.keyCode === 229)
}

/** While composing, skip paste-confirm heuristics (treat as normal keystrokes). */
export function shouldSkipPasteConfirmWhileComposing(composing) {
  return !!composing
}
