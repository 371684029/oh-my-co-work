/** Simple in-process pub/sub for WebSocket fan-out */

const sessionSubs = new Map() // sessionId -> Set<ws>
/** Drop terminal.output when client WS send buffer exceeds this (5.2.0 CLI-14). */
export const WS_TERMINAL_BACKPRESSURE_BYTES = 512 * 1024

export function subscribe(sessionId, ws) {
  if (!sessionSubs.has(sessionId)) sessionSubs.set(sessionId, new Set())
  sessionSubs.get(sessionId).add(ws)
  ws._ecwSessionId = sessionId
}

export function unsubscribe(ws) {
  const sid = ws._ecwSessionId
  if (!sid) return
  const set = sessionSubs.get(sid)
  if (set) {
    set.delete(ws)
    if (set.size === 0) sessionSubs.delete(sid)
  }
  ws._ecwAttachedTerminalId = null
  ws._ecwAttachedTerminalIds = null
}

/**
 * 记录该连接已订阅的终端（Set）：同一会话下 Grok / Cursor 等多个终端切换 Tab 时，
 * 旧 Tab 在后台继续收流，切回来不再丢帧重刷 snapshot。
 */
export function setWsTerminalAttach(ws, terminalId) {
  if (!ws) return
  const tid = terminalId ? String(terminalId) : null
  ws._ecwAttachedTerminalId = tid
  if (!tid) return
  if (!(ws._ecwAttachedTerminalIds instanceof Set)) ws._ecwAttachedTerminalIds = new Set()
  ws._ecwAttachedTerminalIds.add(tid)
}

export function emitTerminalOutput(sessionId, terminalId, event) {
  const set = sessionSubs.get(sessionId)
  if (!set) return
  const tid = String(terminalId || '')
  const raw = JSON.stringify(event)
  for (const ws of set) {
    if (ws.readyState !== 1) continue
    const attached = ws._ecwAttachedTerminalIds
    if (attached instanceof Set ? !attached.has(tid) : ws._ecwAttachedTerminalId !== tid) continue
    if (Number(ws.bufferedAmount || 0) > WS_TERMINAL_BACKPRESSURE_BYTES) {
      try {
        ws.send(
          JSON.stringify({
            type: 'terminal.backpressure',
            payload: { terminalId: tid, message: '输出积压，请重新附着终端' },
          }),
        )
      } catch {
        /* ignore */
      }
      continue
    }
    try {
      ws.send(raw)
    } catch {
      /* ignore */
    }
  }
}

export function emitSession(sessionId, event) {
  const set = sessionSubs.get(sessionId)
  if (!set) return
  const raw = JSON.stringify(event)
  for (const ws of set) {
    if (ws.readyState !== 1) continue
    // 单个濒死 socket 抛错不能冲进 engineEmit/advance 主循环（emitTerminalOutput 同理已容错）
    try {
      ws.send(raw)
    } catch {
      /* ignore */
    }
  }
}

export function emitAll(event) {
  const raw = JSON.stringify(event)
  for (const set of sessionSubs.values()) {
    for (const ws of set) {
      if (ws.readyState !== 1) continue
      try {
        ws.send(raw)
      } catch {
        /* ignore */
      }
    }
  }
}
