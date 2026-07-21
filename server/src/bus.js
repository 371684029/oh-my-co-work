/** Simple in-process pub/sub for WebSocket fan-out */

const sessionSubs = new Map() // sessionId -> Set<ws>

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
