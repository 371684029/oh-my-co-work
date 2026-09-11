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

/** 桌面静默更新尚未实现：禁止返回成功。 */
export function desktopUpdateResult(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    return { ok: false, reason: 'invalid-manifest' }
  }
  return { ok: false, reason: 'not-implemented' }
}
