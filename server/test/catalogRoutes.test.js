import test from 'node:test'
import assert from 'node:assert/strict'
import catalogRoutes from '../src/routes/catalogRoutes.js'

function routeHandler(method, routePath) {
  const layer = (catalogRoutes.stack || []).find((l) => l.route?.path === routePath)
  const route = layer?.route
  if (!route?.methods?.[method]) return null
  return route.stack[0]?.handle
}

test('catalogRoutes registers members and groups list handlers', () => {
  const stack = catalogRoutes.stack || []
  const paths = stack.map((l) => l.route?.path).filter(Boolean)
  assert.ok(paths.includes('/members'))
  assert.ok(paths.includes('/groups'))
})

test('removed adapt member endpoints respond 410', () => {
  const plan = routeHandler('post', '/members/adapt/plan')
  const restore = routeHandler('post', '/members/:id/adapt/restore')
  assert.equal(typeof plan, 'function')
  assert.equal(typeof restore, 'function')
  for (const fn of [plan, restore]) {
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code
        return this
      },
      json(payload) {
        this.body = payload
      },
    }
    fn({ params: { id: 'm1' }, body: {} }, res)
    assert.equal(res.statusCode, 410)
    assert.match(String(res.body?.error || ''), /移除|removed/i)
  }
})
