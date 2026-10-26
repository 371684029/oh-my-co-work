/**
 * Pure notification delivery policy (5.4.0 NTF-T1).
 */

const dedupeStore = new Map()

export function shouldDedupeNotification(key, now = Date.now(), windowMs = 8000) {
  const k = String(key || '').trim()
  if (!k) return false
  const last = dedupeStore.get(k)
  if (last != null && now - last < windowMs) return true
  dedupeStore.set(k, now)
  if (dedupeStore.size > 200) {
    const cutoff = now - windowMs * 2
    for (const [id, t] of dedupeStore) {
      if (t < cutoff) dedupeStore.delete(id)
    }
  }
  return false
}

/** @returns {number} minutes since midnight */
export function parseClockMinutes(hhmm) {
  const m = String(hhmm || '').trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

/** Quiet window may wrap midnight (e.g. 22:00–07:00). */
export function isWithinQuietHours(nowMs, { enabled, start, end } = {}) {
  if (!enabled) return false
  const startM = parseClockMinutes(start)
  const endM = parseClockMinutes(end)
  if (startM == null || endM == null) return false
  const d = new Date(nowMs)
  const cur = d.getHours() * 60 + d.getMinutes()
  if (startM === endM) return true
  if (startM < endM) return cur >= startM && cur < endM
  return cur >= startM || cur < endM
}

export function shouldSuppressForegroundNotification({
  onlyWhenUnfocused,
  documentHidden,
  documentHasFocus,
  viewingSameSession,
  level,
} = {}) {
  if (!onlyWhenUnfocused) return false
  if (documentHidden) return false
  if (!documentHasFocus) return false
  if (level === 'action' && viewingSameSession) return true
  if (level !== 'error' && viewingSameSession) return true
  return false
}

export function shouldThrottleNotification(lastSentAt, nowMs, intervalMs = 30_000) {
  if (!lastSentAt) return false
  return nowMs - lastSentAt < intervalMs
}

/** Merge multiple gate titles for one session into one body line. */
export function mergeGateNotificationBodies(existingBodies, newBody, maxItems = 5) {
  const list = [...(existingBodies || []), String(newBody || '').trim()].filter(Boolean)
  const uniq = []
  for (const b of list) {
    if (!uniq.includes(b)) uniq.push(b)
  }
  const trimmed = uniq.slice(-maxItems)
  return trimmed.join(' · ')
}

export function shouldStopReminding({ readAt, dismissedAt, sentCount, maxReminders = 3 } = {}) {
  if (readAt || dismissedAt) return true
  return Number(sentCount || 0) >= maxReminders
}

/** Electron `Notification` silent flag (5.4.0 NTF-13). */
export function notificationShouldBeSilent({ level, sound } = {}) {
  if (sound === false) return true
  const lv = String(level || 'action').toLowerCase()
  if (lv === 'done' || lv === 'info') return true
  return false
}

export function canDeliverDesktopNotification(ctx) {
  if (!ctx?.enabled) return { ok: false, reason: 'disabled' }
  if (!ctx.levelAllowed) return { ok: false, reason: 'level' }
  if (isWithinQuietHours(ctx.now, ctx.quiet)) return { ok: false, reason: 'quiet' }
  if (shouldSuppressForegroundNotification(ctx.foreground)) {
    return { ok: false, reason: 'foreground' }
  }
  if (shouldThrottleNotification(ctx.lastSentAt, ctx.now, ctx.throttleMs)) {
    return { ok: false, reason: 'throttle' }
  }
  if (shouldStopReminding(ctx.remind)) return { ok: false, reason: 'remind_cap' }
  if (ctx.dedupe) return { ok: false, reason: 'dedupe' }
  return { ok: true, reason: 'deliver' }
}

/**
 * Server event → done-class notification intent (5.4.0 NTF-02 residual).
 * Maps terminal states (session done/archived) and announcement updates to
 * level `done` intents with stable ids for dedupe. Returns null for anything
 * not done-class (gate / node / terminal failures keep living in the renderer
 * intent layer). `docs-updated:<sessionId>` matches the renderer's existing
 * stable id so the server intent and the renderer mapping dedupe into one.
 */
export function doneNotificationIntentForEvent(event, { sessionTitle = '' } = {}) {
  const type = String(event?.type || '').trim()
  const p = (event && event.payload) || {}
  const sessionId = String(p.sessionId || p.session_id || '').trim()
  if (!sessionId) return null
  const title = String(sessionTitle || '').trim() || '会话'

  if (type === 'announcement.updated') {
    return {
      id: `docs-updated:${sessionId}`,
      level: 'done',
      sessionId,
      title: `「${title}」报告已更新`,
      body: '群报告或台账已刷新 · 点击查看',
      deepLink: `docs:${sessionId}:ANNOUNCEMENT.md`,
    }
  }

  const status = String(p.status || '').trim()
  const isTerminal =
    type === 'session.archived' || (type === 'session.status' && (status === 'archived' || status === 'done'))
  if (!isTerminal) return null
  const state = type === 'session.archived' ? 'archived' : status
  return {
    id: `done:session:${sessionId}:${state}`,
    level: 'done',
    sessionId,
    title: state === 'done' ? `「${title}」已完成` : `「${title}」已归档`,
    body:
      state === 'done'
        ? '流程已全部跑完，点击查看结果'
        : '流程已结束并归档，点击查看报告与台账',
    deepLink: `session:${sessionId}`,
  }
}
