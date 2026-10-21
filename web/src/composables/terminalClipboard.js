/**
 * Terminal keyboard copy/paste helpers (5.2.0 CP-01 / CP-03).
 * Pure functions for unit tests; DOM-free.
 */

export function isCopyShortcut(ev, { platform = typeof navigator !== 'undefined' ? navigator.platform : '' } = {}) {
  const mac = /Mac|iPhone|iPod|iPad/i.test(platform)
  const mod = mac ? ev.metaKey : ev.ctrlKey
  if (!mod || ev.altKey) return false
  const k = String(ev.key || '').toLowerCase()
  return k === 'c' && !ev.shiftKey
}

export function isCopyForceShortcut(ev, platform) {
  const mac = /Mac|iPhone|iPod|iPad/i.test(platform || '')
  const mod = mac ? ev.metaKey : ev.ctrlKey
  const k = String(ev.key || '').toLowerCase()
  return mod && ev.shiftKey && k === 'c'
}

export function isPasteShortcut(ev, platform) {
  const mac = /Mac|iPhone|iPod|iPad/i.test(platform || '')
  const mod = mac ? ev.metaKey : ev.ctrlKey
  const k = String(ev.key || '').toLowerCase()
  return mod && ev.shiftKey && k === 'v'
}

export function isInterruptShortcut(ev, platform) {
  const mac = /Mac|iPhone|iPod|iPad/i.test(platform || '')
  const mod = mac ? ev.metaKey : ev.ctrlKey
  const k = String(ev.key || '').toLowerCase()
  return mod && !ev.shiftKey && k === 'c'
}

/** When true, xterm should NOT send Ctrl+C to PTY (copy instead). */
export function shouldCopyInsteadOfInterrupt(xterm, ev, platform) {
  if (!xterm?.hasSelection?.()) return false
  if (isCopyForceShortcut(ev, platform)) return true
  if (isCopyShortcut(ev, platform)) return true
  return false
}

export function shouldHandlePasteShortcut(ev, platform) {
  return isPasteShortcut(ev, platform)
}
