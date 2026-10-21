/** Copy helpers for xterm buffer (5.2.0 CP-02). */

export function copyVisibleTerminalText(xterm) {
  if (!xterm?.buffer?.active) return ''
  const buffer = xterm.buffer.active
  const start = buffer.viewportY
  const rows = Number(xterm.rows) || 0
  const lines = []
  for (let i = 0; i < rows; i++) {
    const line = buffer.getLine(start + i)
    if (line) lines.push(line.translateToString(true))
  }
  return lines.join('\n').replace(/\s+$/u, '')
}

export function scrollTerminalToBottom(xterm) {
  if (!xterm?.buffer?.active) return
  xterm.scrollToBottom()
}
