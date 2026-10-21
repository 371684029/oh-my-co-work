/**
 * Per-scope composer draft + input history (5.2.0 UX-03).
 */

const DRAFT_PREFIX = 'acw.input.draft.'
const HIST_PREFIX = 'acw.input.history.'
const MAX_HISTORY = 50

function safeParse(json, fallback) {
  try {
    return JSON.parse(json)
  } catch {
    return fallback
  }
}

export function loadInputDraft(scopeKey) {
  if (!scopeKey) return ''
  try {
    return localStorage.getItem(`${DRAFT_PREFIX}${scopeKey}`) || ''
  } catch {
    return ''
  }
}

export function saveInputDraft(scopeKey, text) {
  if (!scopeKey) return
  try {
    const t = String(text ?? '')
    if (!t.trim()) localStorage.removeItem(`${DRAFT_PREFIX}${scopeKey}`)
    else localStorage.setItem(`${DRAFT_PREFIX}${scopeKey}`, t)
  } catch {
    /* ignore quota */
  }
}

function loadHistoryList(scopeKey) {
  if (!scopeKey) return []
  try {
    const raw = localStorage.getItem(`${HIST_PREFIX}${scopeKey}`)
    const arr = safeParse(raw, [])
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function saveHistoryList(scopeKey, list) {
  if (!scopeKey) return
  try {
    localStorage.setItem(`${HIST_PREFIX}${scopeKey}`, JSON.stringify(list.slice(-MAX_HISTORY)))
  } catch {
    /* ignore */
  }
}

export function pushInputHistory(scopeKey, text) {
  const t = String(text || '').trim()
  if (!scopeKey || !t) return
  const list = loadHistoryList(scopeKey)
  if (list[list.length - 1] !== t) list.push(t)
  saveHistoryList(scopeKey, list)
}

/**
 * @returns {{ text: string, index: number } | null}
 */
export function stepInputHistory(scopeKey, { index, delta }) {
  const list = loadHistoryList(scopeKey)
  if (!list.length || !delta) return null
  let nextIndex = index
  if (nextIndex < 0) nextIndex = list.length
  nextIndex += delta
  if (nextIndex < 0 || nextIndex >= list.length) return null
  return { text: list[nextIndex], index: nextIndex }
}

export function composerScopeKey(sessionId) {
  return sessionId ? `session:${sessionId}` : ''
}

export function furnaceScopeKey(sessionId, agent) {
  return sessionId ? `furnace:${sessionId}:${agent || 'grok'}` : ''
}
