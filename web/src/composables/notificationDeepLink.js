/**
 * Parse notification deep links (session + docs).
 */

export function parseNotificationDeepLink(deepLink) {
  const raw = String(deepLink || '').trim()
  if (!raw) return null
  let m = raw.match(/^docs:([^:]+):(.+)$/i)
  if (m) return { type: 'docs', sessionId: m[1], file: m[2] }
  m = raw.match(/^session:([^/?#]+)/i)
  if (m) return { type: 'session', sessionId: m[1] }
  m = raw.match(/^acw:\/\/session\/([^/?#]+)/i)
  if (m) return { type: 'session', sessionId: m[1] }
  return null
}
