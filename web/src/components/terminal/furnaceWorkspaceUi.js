/** Furnace workspace hotkeys and labels (FE-01). */

export function furnaceAgentDisplayLabel(agent) {
  return agent === 'cursor' ? 'Cursor' : 'Grok'
}

export function isEventWithinFurnaceRoot(root, event) {
  if (!root || typeof window === 'undefined') return false
  const path = typeof event.composedPath === 'function' ? event.composedPath() : []
  if (path.includes(root)) return true
  return root.contains(event.target) || root.contains(document.activeElement)
}

/** Ctrl/Cmd+1/2 agent switch; returns agent kind or null. */
export function furnaceAgentFromHotkey(key) {
  if (key === '1') return 'grok'
  if (key === '2') return 'cursor'
  return null
}

export function shouldIgnoreFurnaceHotkeyTarget(target) {
  return !!target?.closest?.('.xterm-screen, .xterm-helper-textarea')
}
