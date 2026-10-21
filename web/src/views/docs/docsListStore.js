/**
 * 文档列表客户端缓存（5.2.0 DOC-04）：Hub 与 FlowRail 共用；announcement.updated 增量刷新。
 */
import { api } from '../../api'
import { patchSessionIntoListData } from './docsListPatch.js'

export { patchSessionIntoListData } from './docsListPatch.js'

const TTL_MS = 45_000
const cache = {
  group: { at: 0, data: null },
  time: { at: 0, data: null },
}

const listeners = new Set()

function sortKey(sort) {
  return sort === 'time' ? 'time' : 'group'
}

function notify(sessionId) {
  for (const fn of listeners) {
    try {
      fn(sessionId)
    } catch {
      /* listener */
    }
  }
}

export function subscribeDocsList(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function invalidateDocsListCache() {
  cache.group = { at: 0, data: null }
  cache.time = { at: 0, data: null }
}

export async function getDocsList(sort, { force = false } = {}) {
  const key = sortKey(sort)
  const entry = cache[key]
  const now = Date.now()
  if (!force && entry.data && now - entry.at < TTL_MS) {
    return entry.data
  }
  const data = await api.docs.list(sort)
  cache[key] = { at: now, data }
  return data
}

export function getCachedSessionFiles(sessionId, sort = 'group') {
  const data = cache[sortKey(sort)].data
  if (!data || !sessionId) return null
  if (data.sort === 'group') {
    for (const g of data.groups || []) {
      const s = (g.sessions || []).find((x) => x.sessionId === sessionId)
      if (s) return s.files || []
    }
    return null
  }
  const names = new Set()
  const files = []
  for (const it of data.items || []) {
    if (it.sessionId !== sessionId) continue
    if (names.has(it.name)) continue
    names.add(it.name)
    files.push({
      name: it.name,
      kind: it.kind,
      title: it.title,
      meta: it.meta,
      mtimeMs: it.mtimeMs,
      size: it.size,
    })
  }
  return files.length ? files : null
}

/** WS `announcement.updated` 或保存后：只拉单会话并合并缓存。 */
export async function refreshDocsForSession(sessionId) {
  if (!sessionId) return null
  let summary
  try {
    summary = await api.docs.sessionSummary(sessionId)
  } catch {
    invalidateDocsListCache()
    notify(sessionId)
    return null
  }
  const now = Date.now()
  for (const key of ['group', 'time']) {
    const entry = cache[key]
    if (!entry.data) continue
    entry.data = patchSessionIntoListData(entry.data, summary)
    entry.at = now
  }
  notify(sessionId)
  return summary
}
