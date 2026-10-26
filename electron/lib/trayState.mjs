/**
 * Pure tray state helpers (5.4.0 NTF-07 residual).
 * The desktop shell ships a single icon asset (icon.png / icon.ico), so tray
 * states are surfaced via tooltip + menu header text instead of state bitmaps.
 */

const STATES = new Set(['idle', 'running', 'needs-you', 'error'])

/** Map renderer status strings onto the four desktop tray states. */
export function normalizeTrayStatus(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
  if (!s || s === 'idle' || s === 'none') return 'idle'
  if (['running', 'active', 'busy', 'working'].includes(s)) return 'running'
  if (
    ['needs-you', 'needs_you', 'needsyou', 'action', 'waiting', 'waiting_human', 'gate'].includes(s)
  ) {
    return 'needs-you'
  }
  if (['error', 'failed', 'failure', 'interrupted'].includes(s)) return 'error'
  return 'idle'
}

export function trayStateLabel(state) {
  const s = STATES.has(state) ? state : 'idle'
  return { idle: '空闲', running: '运行中', 'needs-you': '需要你', error: '出错了' }[s]
}

/** Emphasis marker for the menu header row (Electron MenuItem has no bold). */
export function trayStateMarker(state) {
  const s = STATES.has(state) ? state : 'idle'
  return { idle: '○', running: '▶', 'needs-you': '●', error: '✖' }[s]
}

export function isNotificationsPaused(pausedUntil, now = Date.now()) {
  return Number(pausedUntil) > now
}

/** 「暂停通知到明天」→ 明天 09:00（本地时间）。 */
export function pauseUntilTomorrow(now = Date.now()) {
  const d = new Date(now)
  d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  return d.getTime()
}

/** 「暂停通知 1 小时」 */
export function pauseForOneHour(now = Date.now()) {
  return now + 60 * 60 * 1000
}

export function formatPauseEnd(pausedUntil) {
  const t = Number(pausedUntil) || 0
  if (!t) return ''
  const d = new Date(t)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Tray tooltip text for the current state. */
export function formatTrayTooltip({
  state = 'idle',
  pending = 0,
  pausedUntil = 0,
  now = Date.now(),
} = {}) {
  const parts = ['oh-my-co-work']
  parts.push(trayStateLabel(normalizeTrayStatus(state)))
  const n = Math.max(0, Number(pending) || 0)
  if (n > 0) parts.push(`${n} 项待处理`)
  if (isNotificationsPaused(pausedUntil, now)) {
    parts.push(`通知已暂停至 ${formatPauseEnd(pausedUntil)}`)
  }
  return parts.join(' · ')
}

/** Menu header label: state + pending count (bold unavailable, use marker). */
export function formatTrayMenuHeader({ state = 'idle', pending = 0, pausedUntil = 0, now = Date.now() } = {}) {
  const n = Math.max(0, Number(pending) || 0)
  const base = `${trayStateMarker(state)} ${trayStateLabel(state)}${n > 0 ? ` · ${n} 项待处理` : ''}`
  return isNotificationsPaused(pausedUntil, now) ? `${base} · 通知已暂停` : base
}
