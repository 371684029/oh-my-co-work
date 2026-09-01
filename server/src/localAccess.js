import crypto from 'node:crypto'

const API_TOKEN = String(process.env.ACW_API_TOKEN || crypto.randomBytes(32).toString('base64url'))

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''))
  const right = Buffer.from(String(b || ''))
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

function hostnameOf(hostOrUrl) {
  const raw = String(hostOrUrl || '').trim()
  if (!raw || raw === 'null') return ''
  try {
    const url = raw.includes('://') ? new URL(raw) : new URL(`http://${raw}`)
    return String(url.hostname || '').toLowerCase()
  } catch {
    return ''
  }
}

export function isLoopbackHostname(host) {
  const h = hostnameOf(host)
  return h === '127.0.0.1' || h === 'localhost' || h === '::1' || h.endsWith('.localhost')
}

export function isTrustedOrigin(origin) {
  if (!origin) return true
  if (origin === 'null') return false
  try {
    const url = new URL(origin)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      isLoopbackHostname(url.hostname)
    )
  } catch {
    return false
  }
}

/** 本机页面发起的请求：可信 Origin，或同源回环且不是跨站。 */
export function isTrustedLocalRequest(req) {
  const origin = req?.headers?.origin
  const host = req?.headers?.host
  const site = String(req?.headers['sec-fetch-site'] || '').toLowerCase()
  const referer = req?.headers?.referer

  if (site === 'cross-site') return false
  if (origin === 'null') return false
  if (origin) return isTrustedOrigin(origin)
  if (!isLoopbackHostname(host)) return false
  if (referer && !isTrustedOrigin(referer)) return false
  return true
}

export function rejectUntrustedOrigin(req, res, next) {
  if (!isTrustedOrigin(req.headers.origin)) {
    return res.status(403).json({ error: '拒绝非本机页面访问' })
  }
  next()
}

export function bootstrapLocalAccess(req, res) {
  if (!isTrustedLocalRequest(req)) {
    return res.status(403).json({ error: '拒绝非本机页面访问' })
  }
  res.setHeader('Cache-Control', 'no-store')
  res.json({ token: API_TOKEN })
}

/**
 * 提取访问令牌：
 * - REST（requireLocalAccess）只认 Authorization / X-ACW-Token 头，
 *   避免令牌泄入浏览器历史、日志与 Referer（3.8.2 收紧）。
 * - WebSocket 握手无法携带自定义头，allowQuery=true 时保留查询串令牌。
 */
export function requestToken(req, { allowQuery = true } = {}) {
  const authorization = String(req.headers.authorization || '')
  if (authorization.startsWith('Bearer ')) return authorization.slice(7)
  if (req.headers['x-acw-token']) return req.headers['x-acw-token']
  if (!allowQuery) return ''
  if (req.query?.token) return req.query.token
  try {
    return new URL(req.url || '', 'http://127.0.0.1').searchParams.get('token') || ''
  } catch {
    return ''
  }
}

export function hasValidAccessToken(req, { allowQuery = true } = {}) {
  return safeEqual(requestToken(req, { allowQuery }), API_TOKEN)
}

export function requireLocalAccess(req, res, next) {
  if (req.path === '/health') return next()
  if (!hasValidAccessToken(req, { allowQuery: false })) {
    return res.status(401).json({ error: '本地访问令牌无效', code: 'LOCAL_ACCESS_REQUIRED' })
  }
  next()
}
