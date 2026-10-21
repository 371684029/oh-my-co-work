/**
 * Desktop notification layer (5.4.0 NTF-01 foundation).
 * Dedupe, click-to-focus, optional deepLink for session routing.
 */

import { shouldDedupeNotification } from '@acw/shared'

export { shouldDedupeNotification }

/**
 * @param {object} deps
 * @param {() => import('electron').BrowserWindow | null} deps.getMainWindow
 * @param {(deepLink: string) => void} [deps.onDeepLink]
 * @param {typeof import('electron').Notification} deps.Notification
 */
export function createNotifier({ getMainWindow, onDeepLink, Notification }) {
  /**
   * @param {{ id?: string, title: string, body?: string, deepLink?: string, skipDedupe?: boolean }} payload
   */
  function notify(payload) {
    const title = String(payload?.title || '').trim()
    if (!title) return false
    const body = String(payload?.body || '').trim()
    const id = String(payload?.id || `${title}\0${body}`).trim()
    if (!payload?.skipDedupe && shouldDedupeNotification(id)) return false
    if (!Notification.isSupported()) return false
    const n = new Notification({ title, body })
    n.on('click', () => {
      const win = getMainWindow()
      if (win && !win.isDestroyed()) {
        win.show()
        win.focus()
      }
      const link = String(payload?.deepLink || '').trim()
      if (link && onDeepLink) onDeepLink(link)
    })
    n.show()
    return true
  }

  return { notify }
}

/** Parse `session:<id>` or `acw://session/<id>` into session id. */
export function parseSessionDeepLink(deepLink) {
  const raw = String(deepLink || '').trim()
  if (!raw) return null
  let m = raw.match(/^session:([^/?#]+)/i)
  if (m) return m[1]
  m = raw.match(/^acw:\/\/session\/([^/?#]+)/i)
  if (m) return m[1]
  return null
}

/** @returns {{ type: 'session'|'docs', sessionId: string, file?: string } | null} */
export function parseNotificationDeepLink(deepLink) {
  const raw = String(deepLink || '').trim()
  if (!raw) return null
  let m = raw.match(/^docs:([^:]+):(.+)$/i)
  if (m) return { type: 'docs', sessionId: m[1], file: m[2] }
  const sid = parseSessionDeepLink(raw)
  if (sid) return { type: 'session', sessionId: sid }
  return null
}
