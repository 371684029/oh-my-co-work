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

// eslint-disable-next-line no-control-regex -- strip terminal escape sequences from copied text
const ANSI_RE = /\u001b(?:[@-_][0-?]*[ -/]*[@-~]|\[[0-?]*[ -/]*[@-~])/g
// eslint-disable-next-line no-control-regex -- OSC sequences
const OSC_RE = /\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g

/** 复制后清理：去 ANSI、行尾空白、多余空行（5.2.0 CP-05）。 */
export function formatTerminalCopyText(text) {
  return String(text || '')
    .replace(OSC_RE, '')
    .replace(ANSI_RE, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/u, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+$/u, '')
}

/** 优先选区，否则空；统一走 formatTerminalCopyText。 */
export function getTerminalCopyText(xterm) {
  if (!xterm?.hasSelection?.()) return ''
  return formatTerminalCopyText(xterm.getSelection())
}
