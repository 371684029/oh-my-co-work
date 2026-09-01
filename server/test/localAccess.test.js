import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bootstrapLocalAccess,
  hasValidAccessToken,
  isTrustedOrigin,
} from '../src/localAccess.js'

function jsonRes() {
  const out = { statusCode: 200, body: null }
  return {
    out,
    setHeader() {},
    status(code) {
      out.statusCode = code
      return this
    },
    json(value) {
      out.body = value
      return this
    },
  }
}

test('only loopback browser origins are trusted', () => {
  assert.equal(isTrustedOrigin('http://127.0.0.1:3780'), true)
  assert.equal(isTrustedOrigin('http://localhost:5173'), true)
  assert.equal(isTrustedOrigin('https://example.com'), false)
  assert.equal(isTrustedOrigin('null'), false)
})

test('bootstrap requires a trusted Origin and then issues a token', () => {
  const blocked = jsonRes()
  bootstrapLocalAccess({ headers: {} }, blocked)
  assert.equal(blocked.out.statusCode, 403)

  const evil = jsonRes()
  bootstrapLocalAccess({ headers: { origin: 'https://example.com' } }, evil)
  assert.equal(evil.out.statusCode, 403)

  const crossSite = jsonRes()
  bootstrapLocalAccess(
    { headers: { host: '127.0.0.1:3780', 'sec-fetch-site': 'cross-site' } },
    crossSite,
  )
  assert.equal(crossSite.out.statusCode, 403)

  const sameOriginNoHeader = jsonRes()
  bootstrapLocalAccess({ headers: { host: '127.0.0.1:3780' } }, sameOriginNoHeader)
  assert.equal(sameOriginNoHeader.out.statusCode, 200)
  assert.ok(sameOriginNoHeader.out.body?.token)

  const ok = jsonRes()
  bootstrapLocalAccess({ headers: { origin: 'http://127.0.0.1:5173' } }, ok)
  assert.equal(ok.out.statusCode, 200)
  assert.ok(ok.out.body?.token)
  const token = ok.out.body.token
  assert.equal(
    hasValidAccessToken({ headers: { 'x-acw-token': token }, query: {} }),
    true,
  )
  assert.equal(hasValidAccessToken({ headers: {}, query: {} }), false)
  assert.equal(
    hasValidAccessToken({ headers: { 'x-acw-token': `${token}x` }, query: {} }),
    false,
  )
  assert.equal(
    hasValidAccessToken({
      headers: {},
      url: `/ws?sessionId=test&token=${encodeURIComponent(token)}`,
    }),
    true,
  )
})

test('REST auth rejects query-string tokens; WebSocket keeps them (3.8.2)', () => {
  const boot = jsonRes()
  bootstrapLocalAccess({ headers: { origin: 'http://127.0.0.1:5173' } }, boot)
  const token = boot.out.body.token

  // WebSocket 风格（默认 allowQuery=true）：查询串令牌仍然有效
  assert.equal(
    hasValidAccessToken({
      headers: {},
      url: `/ws?sessionId=test&token=${encodeURIComponent(token)}`,
    }),
    true,
  )
  // REST（allowQuery=false）：查询串令牌一律拒绝
  assert.equal(
    hasValidAccessToken(
      { headers: {}, url: `/api/sessions?token=${encodeURIComponent(token)}` },
      { allowQuery: false },
    ),
    false,
  )
  assert.equal(
    hasValidAccessToken({ headers: {}, query: { token } }, { allowQuery: false }),
    false,
  )
  // 头部令牌在 REST 上不受影响
  assert.equal(
    hasValidAccessToken(
      { headers: { authorization: `Bearer ${token}` }, url: '/api/sessions' },
      { allowQuery: false },
    ),
    true,
  )
  assert.equal(
    hasValidAccessToken(
      { headers: { 'x-acw-token': token }, query: { token: 'bad' } },
      { allowQuery: false },
    ),
    true,
  )
  // 错误令牌仍被拒
  assert.equal(
    hasValidAccessToken(
      { headers: { 'x-acw-token': `${token}x` }, url: '/api/sessions' },
      { allowQuery: false },
    ),
    false,
  )
})
