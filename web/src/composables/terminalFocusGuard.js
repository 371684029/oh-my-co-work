/**
 * Restore focus to last active terminal after overlays close (5.1.0 CLI-09 / 5.2.0 UX-02).
 */

let lastFocus = null

export function registerTerminalFocus(target) {
  if (target && typeof target.focus === 'function') {
    lastFocus = target
  }
}

export function restoreTerminalFocus(delayMs = 50) {
  const t = lastFocus
  if (!t?.focus) return
  window.setTimeout(() => {
    try {
      t.focus()
    } catch {
      /* ignore */
    }
  }, delayMs)
}

export function clearTerminalFocusRegistration(target) {
  if (lastFocus === target) lastFocus = null
}
