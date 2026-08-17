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
