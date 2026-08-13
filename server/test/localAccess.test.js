import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bootstrapLocalAccess,
  hasValidAccessToken,
  isTrustedOrigin,
} from '../src/localAccess.js'

test('only loopback browser origins are trusted', () => {
  assert.equal(isTrustedOrigin('http://127.0.0.1:3780'), true)
  assert.equal(isTrustedOrigin('http://localhost:5173'), true)
  assert.equal(isTrustedOrigin('https://example.com'), false)
  assert.equal(isTrustedOrigin('null'), false)
})

test('bootstrap token is required by protected requests', () => {
  let body
  bootstrapLocalAccess(
    {},
    {
      setHeader() {},
      json(value) {
        body = value
      },
    },
  )
  assert.ok(body?.token)
  assert.equal(
    hasValidAccessToken({ headers: { 'x-acw-token': body.token }, query: {} }),
    true,
  )
  assert.equal(hasValidAccessToken({ headers: {}, query: {} }), false)
  assert.equal(
    hasValidAccessToken({ headers: { 'x-acw-token': `${body.token}x` }, query: {} }),
    false,
  )
})

