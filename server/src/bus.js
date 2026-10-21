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
}

/** Only the terminal the client last attached receives high-volume output (CLI-14). */
export function setWsTerminalAttach(ws, terminalId) {
  if (!ws) return
  ws._ecwAttachedTerminalId = terminalId ? String(terminalId) : null
}

export function emitTerminalOutput(sessionId, terminalId, event) {
  const set = sessionSubs.get(sessionId)
  if (!set) return
  const tid = String(terminalId || '')
  const raw = JSON.stringify(event)
  for (const ws of set) {
    if (ws.readyState !== 1) continue
    if (ws._ecwAttachedTerminalId !== tid) continue
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
    if (ws.readyState === 1) ws.send(raw)
  }
}

export function emitAll(event) {
  const raw = JSON.stringify(event)
  for (const set of sessionSubs.values()) {
    for (const ws of set) {
      if (ws.readyState === 1) ws.send(raw)
    }
  }
}
