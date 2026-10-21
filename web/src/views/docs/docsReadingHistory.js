/**
 * Recent & pinned docs (5.2.0 DOC-19).
 */

export const DOCS_HISTORY_KEY = 'acw.docsReadingHistory'
const MAX_RECENT = 24

function keyOf(entry) {
  return `${entry.sessionId}::${entry.name}`
}

export function readDocsReadingHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(DOCS_HISTORY_KEY) || '{}')
    return {
      recent: Array.isArray(raw.recent) ? raw.recent : [],
      pinned: Array.isArray(raw.pinned) ? raw.pinned : [],
    }
  } catch {
    return { recent: [], pinned: [] }
  }
}

function writeHistory(state) {
  try {
    localStorage.setItem(
      DOCS_HISTORY_KEY,
      JSON.stringify({
        recent: state.recent.slice(0, MAX_RECENT),
        pinned: state.pinned,
      }),
    )
  } catch {
    /* ignore quota */
  }
}

/**
 * @param {{ sessionId: string, name: string, label?: string, sessionTitle?: string }} entry
 */
export function recordDocsOpen(entry) {
  const sessionId = String(entry?.sessionId || '').trim()
  const name = String(entry?.name || '').trim()
  if (!sessionId || !name) return readDocsReadingHistory()
  const state = readDocsReadingHistory()
  const item = {
    sessionId,
    name,
    label: String(entry.label || entry.name || name),
    sessionTitle: String(entry.sessionTitle || ''),
    openedAt: Date.now(),
  }
  const k = keyOf(item)
  state.recent = [item, ...state.recent.filter((x) => keyOf(x) !== k)]
  writeHistory(state)
  return state
}

export function isDocsPinned(sessionId, name, pinnedList) {
  const k = `${sessionId}::${name}`
  return (pinnedList || []).some((x) => keyOf(x) === k)
}

export function toggleDocsPin(entry) {
  const sessionId = String(entry?.sessionId || '').trim()
  const name = String(entry?.name || '').trim()
  if (!sessionId || !name) return readDocsReadingHistory()
  const state = readDocsReadingHistory()
  const k = keyOf({ sessionId, name })
  const idx = state.pinned.findIndex((x) => keyOf(x) === k)
  if (idx >= 0) {
    state.pinned.splice(idx, 1)
  } else {
    state.pinned.unshift({
      sessionId,
      name,
      label: String(entry.label || name),
      sessionTitle: String(entry.sessionTitle || ''),
      pinnedAt: Date.now(),
    })
  }
  writeHistory(state)
  return state
}

export function recentDocsPreview(recent, limit = 3) {
  return (recent || []).slice(0, Math.max(0, limit))
}
