import {
  MAX_INPUT_CHARS,
  MAX_INPUT_BYTES_PER_SECOND,
  MAX_INPUT_MESSAGES_PER_SECOND,
  clampTerminalSize,
} from './inputLimits.js'

function sendWs(ws, event) {
  if (ws?.readyState === 1) ws.send(JSON.stringify(event))
}

/**
 * Handle terminal.* WebSocket messages from the browser.
 * @param {object} deps - terminal service hooks (avoids circular imports)
 */
export function handleTerminalClientMessage(deps, ws, sessionId, raw) {
  const {
    getEntry,
    setWsTerminalAttach,
    flushOutput,
    publicTerminal,
    killTerminal,
  } = deps

  let message
  try {
    message = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(raw.toString())
  } catch {
    return false
  }
  if (!String(message?.type || '').startsWith('terminal.')) return false

  const terminalId = String(message.terminalId || message.payload?.terminalId || '')
  const entry = getEntry(terminalId)
  if (!entry || entry.sessionId !== sessionId) {
    sendWs(ws, {
      type: 'terminal.error',
      payload: { terminalId, code: 'TERMINAL_NOT_FOUND', message: '终端不存在或不属于当前会话' },
    })
    return true
  }

  if (message.type === 'terminal.attach') {
    setWsTerminalAttach(ws, terminalId)
    if (entry.pendingOutput) {
      if (entry.flushTimer) clearTimeout(entry.flushTimer)
      flushOutput(entry)
    }
    sendWs(ws, {
      type: 'terminal.snapshot',
      payload: {
        terminalId,
        terminal: publicTerminal(entry),
        seq: entry.seq,
        data: entry.replay,
        truncated: entry.replayTruncated,
      },
    })
    return true
  }
  if (message.type === 'terminal.input') {
    const data = String(message.data ?? message.payload?.data ?? '')
    if (data.length > MAX_INPUT_CHARS) {
      sendWs(ws, {
        type: 'terminal.error',
        payload: {
          terminalId,
          code: 'INPUT_TOO_LARGE',
          message: '单次终端输入过大（超过 64KB）。请改用分块粘贴，或保存为文件后用命令读取。',
        },
      })
      return true
    }
    const now = Date.now()
    if (now - entry.inputWindowAt >= 1000) {
      entry.inputWindowAt = now
      entry.inputBytesInWindow = 0
      entry.inputMessagesInWindow = 0
    }
    entry.inputBytesInWindow += Buffer.byteLength(data)
    entry.inputMessagesInWindow += 1
    if (
      entry.inputBytesInWindow > MAX_INPUT_BYTES_PER_SECOND ||
      entry.inputMessagesInWindow > MAX_INPUT_MESSAGES_PER_SECOND
    ) {
      sendWs(ws, {
        type: 'terminal.error',
        payload: { terminalId, code: 'INPUT_RATE_LIMITED', message: '终端输入过于频繁' },
      })
      return true
    }
    try {
      if (entry.status === 'running') entry.process.write(data)
    } catch {
      sendWs(ws, {
        type: 'terminal.error',
        payload: { terminalId, code: 'TERMINAL_NOT_RUNNING', message: '终端已结束' },
      })
    }
    return true
  }
  if (message.type === 'terminal.resize') {
    const cols = clampTerminalSize(message.cols ?? message.payload?.cols, entry.cols, 20, 300)
    const rows = clampTerminalSize(message.rows ?? message.payload?.rows, entry.rows, 5, 120)
    entry.cols = cols
    entry.rows = rows
    try {
      if (entry.status === 'running') entry.process.resize(cols, rows)
    } catch {
      sendWs(ws, {
        type: 'terminal.error',
        payload: { terminalId, code: 'RESIZE_FAILED', message: '终端尺寸同步失败' },
      })
    }
    return true
  }
  if (message.type === 'terminal.kill') {
    killTerminal(terminalId, 'user')
    return true
  }
  return true
}
