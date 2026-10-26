/**
 * Missed / recent notifications inbox (5.4.0 NTF-06).
 * Since 5.5.0 rows persist to the server SQLite `notification_inbox` and load
 * from the API on startup (restart-safe); localStorage stays as offline cache
 * fallback whenever the API is unreachable. All API writes are write-through
 * and fire-and-forget so callers keep the synchronous local behavior.
 */
import { computed, ref } from 'vue'
import { api } from '../api.js'
import { syncTrayStatus } from './syncTrayStatus.js'

const STORAGE_KEY = 'acw.notification.inbox'
const MAX_ITEMS = 120

const items = ref([])

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    items.value = Array.isArray(parsed) ? parsed : []
  } catch {
    items.value = []
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value.slice(0, MAX_ITEMS)))
  } catch {
    /* ignore */
  }
}

load()

/** Local row → server API row (pure). */
export function toInboxApiRow(entry) {
  const at = String(entry?.at || '')
  const createdAt = at ? Date.parse(at) : NaN
  return {
    id: String(entry?.id || ''),
    eventId: String(entry?.eventId || entry?.id || ''),
    level: String(entry?.level || 'action'),
    sessionId: entry?.sessionId != null ? String(entry.sessionId) : null,
    title: String(entry?.title || ''),
    body: String(entry?.body || ''),
    deepLink: entry?.deepLink != null ? String(entry.deepLink) : null,
    read: !!entry?.read,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
  }
}

/** Server API row → local row shape (pure). */
export function fromInboxApiRow(row) {
  const createdAt = Number(row?.createdAt) || 0
  return {
    id: String(row?.id || ''),
    at: row?.at || (createdAt ? new Date(createdAt).toISOString() : new Date().toISOString()),
    level: String(row?.level || 'action'),
    title: String(row?.title || ''),
    body: String(row?.body || ''),
    sessionId: row?.sessionId != null ? String(row.sessionId) : null,
    deepLink: row?.deepLink != null ? String(row.deepLink) : null,
    read: !!row?.read,
    handledAt: null,
    handleAction: null,
  }
}

/** Top pending (unread) rows for the tray 「待处理（最多 5 条）」 submenu (pure). */
export function inboxTrayItems(rows, max = 5) {
  return (Array.isArray(rows) ? rows : [])
    .filter((it) => it && !it.read)
    .slice(0, Math.max(1, Number(max) || 5))
    .map((it) => ({
      id: String(it.id || ''),
      title: String(it.title || ''),
      level: String(it.level || 'action'),
      deepLink: it.deepLink != null ? String(it.deepLink) : '',
    }))
}

function writeThrough(fn) {
  try {
    const p = fn()
    if (p && typeof p.catch === 'function') p.catch(() => {})
  } catch {
    /* API 不可用时保留 localStorage 缓存 */
  }
}

/** Push pending count + top items to the Electron tray (NTF-07). */
function pushInboxTraySync() {
  const unread = items.value.filter((it) => !it.read)
  const hasError = unread.some((it) => it.level === 'error')
  const hasAction = unread.some((it) => it.level === 'action')
  syncTrayStatus({
    pending: unread.length,
    status: hasError ? 'error' : hasAction ? 'needs-you' : 'idle',
    items: inboxTrayItems(items.value),
  })
}

export function notificationInboxRef() {
  return items
}

export const unreadInboxCount = computed(
  () => items.value.filter((it) => !it.read).length,
)

export function recordNotificationInbox(entry) {
  const id = String(entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
  const row = {
    id,
    at: entry.at || new Date().toISOString(),
    level: entry.level || 'action',
    title: String(entry.title || '').trim(),
    body: String(entry.body || '').trim(),
    sessionId: entry.sessionId || null,
    deepLink: entry.deepLink || null,
    read: false,
    handledAt: null,
    handleAction: null,
  }
  if (!row.title) return
  const dup = items.value.find((x) => x.id === id)
  if (dup) {
    Object.assign(dup, row, { read: dup.read })
  } else {
    items.value.unshift(row)
  }
  if (items.value.length > MAX_ITEMS) items.value.length = MAX_ITEMS
  persist()
  writeThrough(() => api.notificationInbox.record(toInboxApiRow(items.value.find((x) => x.id === id))))
  pushInboxTraySync()
}

export function markInboxRead(id) {
  const hit = items.value.find((x) => x.id === id)
  if (!hit) return
  hit.read = true
  persist()
  writeThrough(() => api.notificationInbox.read({ ids: [id] }))
  pushInboxTraySync()
}

export function getInboxEntry(id) {
  return items.value.find((x) => x.id === id) || null
}

/** Click/dismiss on system notification (5.4.0 NTF-14). */
export function markInboxHandled(id, action = 'click') {
  const hit = items.value.find((x) => x.id === id)
  if (!hit) return
  hit.read = true
  hit.handledAt = new Date().toISOString()
  hit.handleAction = String(action || 'click')
  persist()
  writeThrough(() => api.notificationInbox.read({ ids: [id] }))
  pushInboxTraySync()
}

export function markAllInboxRead() {
  for (const it of items.value) it.read = true
  persist()
  writeThrough(() => api.notificationInbox.read({ all: true }))
  pushInboxTraySync()
}

export function clearInbox() {
  items.value = []
  persist()
  writeThrough(() => api.notificationInbox.clear())
  pushInboxTraySync()
}

export function inboxSummarySince(lastSeenIso) {
  const since = lastSeenIso ? new Date(lastSeenIso).getTime() : 0
  const recent = items.value.filter((it) => new Date(it.at).getTime() > since)
  return { count: recent.length, unread: recent.filter((x) => !x.read).length }
}

/**
 * Load persisted rows from the server on startup and merge with the local
 * cache. Server rows win on conflicts (read state is authoritative); purely
 * local rows (offline recordings) are kept until the API sees them.
 */
export async function loadNotificationInbox({ limit = 200 } = {}) {
  let serverItems = null
  try {
    const res = await api.notificationInbox.list({ limit })
    serverItems = Array.isArray(res?.items) ? res.items.map(fromInboxApiRow) : []
  } catch {
    serverItems = null
  }
  if (serverItems) {
    const byId = new Map(serverItems.map((it) => [it.id, it]))
    for (const local of items.value) {
      if (!local?.id || byId.has(local.id)) continue
      byId.set(local.id, local)
    }
    const merged = [...byId.values()].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    )
    items.value = merged.slice(0, MAX_ITEMS)
    persist()
  }
  pushInboxTraySync()
  return items.value
}
