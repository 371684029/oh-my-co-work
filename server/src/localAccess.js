import crypto from 'node:crypto'

const API_TOKEN = String(process.env.ACW_API_TOKEN || crypto.randomBytes(32).toString('base64url'))

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''))
  const right = Buffer.from(String(b || ''))
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

export function isTrustedOrigin(origin) {
  if (!origin) return true
  if (origin === 'null') return false
  try {
    const url = new URL(origin)
    const host = url.hostname.toLowerCase()
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      (host === '127.0.0.1' || host === 'localhost' || host === '[::1]' || host === '::1')
    )
  } catch {
    return false
  }
}

export function rejectUntrustedOrigin(req, res, next) {
  if (!isTrustedOrigin(req.headers.origin)) {
    return res.status(403).json({ error: '拒绝非本机页面访问' })
  }
  next()
}

export function bootstrapLocalAccess(_req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.json({ token: API_TOKEN })
}

export function requestToken(req) {
  const authorization = String(req.headers.authorization || '')
  if (authorization.startsWith('Bearer ')) return authorization.slice(7)
  return req.headers['x-acw-token'] || req.query?.token || ''
}

export function hasValidAccessToken(req) {
  return safeEqual(requestToken(req), API_TOKEN)
}

export function requireLocalAccess(req, res, next) {
  if (req.path === '/health') return next()
  if (!hasValidAccessToken(req)) {
    return res.status(401).json({ error: '本地访问令牌无效', code: 'LOCAL_ACCESS_REQUIRED' })
  }
  next()
}

