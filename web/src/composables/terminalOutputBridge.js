/**
 * Non-reactive terminal output buffer (5.1.0 CLI-11 / CLI-12).
 * Keeps replay outside Vue reactivity; TerminalView subscribes for writes.
 *
 * 5.x 内存修复：每个终端的 replay 上限为 8MiB（33f81ec），且 entries 只增
 * 不删——长时间工作台会话（熔炉输出密集）下无界增长。现在加上限淘汰 +
 * 会话切换时全量清理。
 */
const MAX_ENTRIES = 48

const entries = new Map()

function ensure(id) {
  if (!entries.has(id)) {
    if (entries.size >= MAX_ENTRIES) {
      // Map 按插入序迭代：淘汰最旧的一批（那些终端早已不在列表里）
      const drop = Math.max(1, Math.floor(MAX_ENTRIES / 4))
      let dropped = 0
      for (const key of entries.keys()) {
        if (dropped >= drop) break
        entries.delete(key)
        dropped += 1
      }
    }
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
    e.replay = `${e.replay}${chunk}`.slice(-8_388_608)
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

export function terminalOutputGetSeq(terminalId) {
  return entries.get(String(terminalId || ''))?.seq ?? 0
}

/**
 * Free all replay buffers. Called on session switch / terminal dispose —
 * snapshots from the server repopulate anything still needed after re-attach.
 */
export function terminalOutputForgetAll() {
  entries.clear()
}

/** Test helper */
export function terminalOutputClearAll() {
  entries.clear()
}
