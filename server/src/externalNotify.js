/**
 * External POST /api/notify (5.4.0 NTF-17): rate limit + payload validation.
 */

const RATE_WINDOW_MS = 60_000
const RATE_MAX = 30
/** @type {Map<string, number[]>} */
const hitsBySource = new Map()

export function validateNotifyPayload(body) {
  const title = String(body?.title || '').trim()
  const text = String(body?.body ?? body?.message ?? '').trim()
  if (!title || title.length > 120) {
    throw Object.assign(new Error('标题必填且不超过 120 字'), { code: 'BAD_TITLE' })
  }
  if (text.length > 500) {
    throw Object.assign(new Error('正文不超过 500 字'), { code: 'BAD_BODY' })
  }
  const level = String(body?.level || 'action').toLowerCase()
  if (!['action', 'error', 'done'].includes(level)) {
    throw Object.assign(new Error('level 无效'), { code: 'BAD_LEVEL' })
  }
  const deepLink = body?.deepLink != null ? String(body.deepLink).trim().slice(0, 256) : ''
  const source = String(body?.source || 'external').trim().slice(0, 64) || 'external'
  return { title, body: text, level, deepLink, source }
}

export function assertNotifyRateLimit(source, now = Date.now()) {
  const key = String(source || 'external')
  const arr = hitsBySource.get(key) || []
  const recent = arr.filter((t) => now - t < RATE_WINDOW_MS)
  if (recent.length >= RATE_MAX) {
    throw Object.assign(new Error('通知频率过高，请稍后再试'), { code: 'RATE_LIMIT' })
  }
  recent.push(now)
  hitsBySource.set(key, recent)
}
