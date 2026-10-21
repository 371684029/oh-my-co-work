/**
 * Non-reactive terminal output buffer (5.1.0 CLI-11 / CLI-12).
 * Keeps replay outside Vue reactivity; TerminalView subscribes for writes.
 */

const entries = new Map()

function ensure(id) {
  if (!entries.has(id)) {
    entries.set(id, { replay: '', seq: 0, listeners: new Set(), pending: [] })
  }
  return entries.get(id)
}

export function terminalOutputAppend(terminalId, { seq, data }) {
  const id = String(terminalId || '')
  if (!id) return
  const e = ensure(id)
  const nextSeq = Number(seq || 0)
  const chunk = String(data || '')
  if (chunk) {
    e.replay = `${e.replay}${chunk}`.slice(-256_000)
    e.pending.push({ seq: nextSeq, data: chunk })
  }
  e.seq = Math.max(e.seq, nextSeq)
  for (const fn of e.listeners) {
    try {
      fn({ seq: nextSeq, data: chunk, replay: e.replay })
    } catch {
      /* ignore */
    }
  }
}

export function terminalOutputReset(terminalId, replay = '', seq = 0) {
  const id = String(terminalId || '')
  if (!id) return
  const e = ensure(id)
  e.replay = String(replay || '')
  e.seq = Number(seq || 0)
  e.pending.length = 0
  for (const fn of e.listeners) {
    try {
      fn({ seq: e.seq, data: '', replay: e.replay, reset: true })
    } catch {
      /* ignore */
    }
  }
}

export function terminalOutputSubscribe(terminalId, listener) {
  const id = String(terminalId || '')
  if (!id || typeof listener !== 'function') return () => {}
  const e = ensure(id)
  e.listeners.add(listener)
  return () => e.listeners.delete(listener)
}

export function terminalOutputDrainPending(terminalId, afterSeq) {
  const e = entries.get(String(terminalId || ''))
  if (!e) return []
  const from = Number(afterSeq || 0)
  const out = e.pending.filter((p) => p.seq > from)
  e.pending = e.pending.filter((p) => p.seq <= from)
  return out.sort((a, b) => a.seq - b.seq)
}

export function terminalOutputGetReplay(terminalId) {
  return entries.get(String(terminalId || ''))?.replay ?? ''
}

/** Test helper */
export function terminalOutputClearAll() {
  entries.clear()
}
