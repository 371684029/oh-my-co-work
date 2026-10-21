/**
 * Missed / recent notifications inbox (5.4.0 NTF-06 partial).
 */
import { computed, ref } from 'vue'

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
}

export function markInboxRead(id) {
  const hit = items.value.find((x) => x.id === id)
  if (hit) hit.read = true
  persist()
}

export function markAllInboxRead() {
  for (const it of items.value) it.read = true
  persist()
}

export function clearInbox() {
  items.value = []
  persist()
}

export function inboxSummarySince(lastSeenIso) {
  const since = lastSeenIso ? new Date(lastSeenIso).getTime() : 0
  const recent = items.value.filter((it) => new Date(it.at).getTime() > since)
  return { count: recent.length, unread: recent.filter((x) => !x.read).length }
}
