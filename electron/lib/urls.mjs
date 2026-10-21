/** History 路由下的工作台地址（不是 hash、也不是 ?session=）。 */

export function normalizeAppOrigin(base) {
  const raw = String(base || '').trim()
  if (!raw) return 'http://127.0.0.1:3780'
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return 'http://127.0.0.1:3780'
    }
    return `${u.protocol}//${u.host}`
  } catch {
    return 'http://127.0.0.1:3780'
  }
}

export function workbenchUrl(base, sessionId) {
  const origin = normalizeAppOrigin(base)
  const id = String(sessionId || '').trim()
  if (!id) return `${origin}/workbench`
  return `${origin}/workbench/${encodeURIComponent(id)}`
}

export function docsHubUrl(base, sessionId, file = 'ANNOUNCEMENT.md') {
  const origin = normalizeAppOrigin(base)
  const id = String(sessionId || '').trim()
  const name = String(file || 'ANNOUNCEMENT.md').trim()
  if (!id) return `${origin}/docs`
  const q = new URLSearchParams({ session: id, file: name })
  return `${origin}/docs?${q.toString()}`
}

export { desktopUpdateResult } from './desktopUpdate.mjs'
