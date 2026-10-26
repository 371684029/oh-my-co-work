/**
 * Notification inbox persistence (5.4.0 NTF-06): SQLite `notification_inbox`.
 * Rows are written by the server-side notification intent layer (NTF-02) and by
 * the web inbox write-through API. Row id doubles as the stable eventId used for
 * dedupe, so re-record of the same event upserts instead of duplicating.
 */
import { getDb } from './db.js'

const MAX_ROWS = 500

/** DB row → API/local shape (camelCase, ISO time for the web cache). */
export function serializeInboxRow(row) {
  if (!row) return null
  const createdAt = Number(row.created_at) || 0
  return {
    id: String(row.id),
    eventId: row.event_id != null ? String(row.event_id) : null,
    level: String(row.level || 'action'),
    sessionId: row.session_id != null ? String(row.session_id) : null,
    title: String(row.title || ''),
    body: String(row.body || ''),
    deepLink: row.deep_link != null ? String(row.deep_link) : null,
    read: row.read ? true : false,
    createdAt,
    at: createdAt ? new Date(createdAt).toISOString() : null,
  }
}

function normalizeItem(item) {
  const id = String(item?.id || '').trim()
  const title = String(item?.title || '').trim()
  if (!id || !title) {
    throw Object.assign(new Error('id 与 title 必填'), { code: 'BAD_ITEM' })
  }
  const createdAt = Number(item?.createdAt) || Date.now()
  return {
    id,
    event_id: String(item?.eventId || item?.event_id || id),
    level: String(item?.level || 'action').slice(0, 32),
    session_id: item?.sessionId != null ? String(item.sessionId).slice(0, 64) : null,
    title: title.slice(0, 200),
    body: String(item?.body || '').slice(0, 1000),
    deep_link: item?.deepLink != null ? String(item.deepLink).slice(0, 256) : null,
    read: item?.read ? 1 : 0,
    created_at: createdAt,
  }
}

/** Insert or update one inbox row (idempotent by id). */
export function upsertInboxItem(item) {
  const row = normalizeItem(item)
  getDb()
    .prepare(
      `INSERT INTO notification_inbox
        (id, event_id, level, session_id, title, body, deep_link, read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         event_id = excluded.event_id,
         level = excluded.level,
         session_id = excluded.session_id,
         title = excluded.title,
         body = excluded.body,
         deep_link = excluded.deep_link,
         read = notification_inbox.read,
         created_at = notification_inbox.created_at`,
    )
    .run(
      row.id,
      row.event_id,
      row.level,
      row.session_id,
      row.title,
      row.body,
      row.deep_link,
      row.read,
      row.created_at,
    )
  pruneInbox()
  return serializeInboxRow(
    getDb().prepare('SELECT * FROM notification_inbox WHERE id = ?').get(row.id),
  )
}

/** Newest first; `unread=1` filters to unread rows. */
export function listInboxItems({ unread = false, limit = 200 } = {}) {
  const cap = Math.max(1, Math.min(500, Number(limit) || 200))
  const sql = unread
    ? 'SELECT * FROM notification_inbox WHERE read = 0 ORDER BY created_at DESC, id DESC LIMIT ?'
    : 'SELECT * FROM notification_inbox ORDER BY created_at DESC, id DESC LIMIT ?'
  return getDb()
    .prepare(sql)
    .all(cap)
    .map(serializeInboxRow)
}

/** Mark specific ids (or all rows) read. Returns number of rows touched. */
export function markInboxRead({ ids, all = false } = {}) {
  if (all) {
    return getDb().prepare('UPDATE notification_inbox SET read = 1 WHERE read = 0').run().changes || 0
  }
  const list = (Array.isArray(ids) ? ids : [])
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .slice(0, 200)
  if (!list.length) {
    throw Object.assign(new Error('ids 必填或使用 all:true'), { code: 'BAD_IDS' })
  }
  const placeholders = list.map(() => '?').join(', ')
  return (
    getDb()
      .prepare(`UPDATE notification_inbox SET read = 1 WHERE id IN (${placeholders})`)
      .run(...list).changes || 0
  )
}

export function clearInboxItems() {
  return getDb().prepare('DELETE FROM notification_inbox').run().changes || 0
}

/** Keep only the newest MAX_ROWS rows (append-only table, bounded growth). */
export function pruneInbox(max = MAX_ROWS) {
  const cap = Math.max(1, Number(max) || MAX_ROWS)
  getDb()
    .prepare(
      `DELETE FROM notification_inbox WHERE id NOT IN (
         SELECT id FROM notification_inbox ORDER BY created_at DESC, id DESC LIMIT ?
       )`,
    )
    .run(cap)
}
