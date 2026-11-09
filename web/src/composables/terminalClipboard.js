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

/**
 * 熔炉 Ctrl+C 防误杀机制 (FURNACE-INTERRUPT-GUARD)：
 * 在熔炉运行态，若用户没有选中文本而按下 Ctrl+C，极有可能是试图复制或误触。
 * 如果直接把 \x03 发到 Windows ConPTY 会引发 STATUS_CONTROL_C_EXIT (0xC000013A)，
 * 导致整个 Grok / Cursor 进程瞬间崩溃退出黑屏。
 * 提供防误杀保护器：需在 windowMs（默认 1500ms）内连续按两次 Ctrl+C 才允许发送中断信号。
 */
export function createFurnaceInterruptGuard({ windowMs = 1500, now = () => Date.now() } = {}) {
  let lastAttemptAt = 0

  return {
    /**
     * @returns {{ allowInterrupt: boolean, isFirstAttempt: boolean }}
     */
    check() {
      const current = now()
      if (lastAttemptAt > 0 && current - lastAttemptAt <= windowMs) {
        lastAttemptAt = 0
        return { allowInterrupt: true, isFirstAttempt: false }
      }
      lastAttemptAt = current
      return { allowInterrupt: false, isFirstAttempt: true }
    },
    reset() {
      lastAttemptAt = 0
    },
  }
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
