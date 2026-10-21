import assert from 'node:assert/strict'
import test from 'node:test'

test('GET /api/health is open; GET /api/diagnostics requires token', async (t) => {
  process.env.ACW_API_TOKEN = 'integration-test-token'
  const express = (await import('express')).default
  const routes = (await import('../src/routes.js')).default
  const { requireLocalAccess } = await import('../src/localAccess.js')

  const app = express()
  app.use(express.json())
  app.use('/api', requireLocalAccess)
  app.use('/api', routes)

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  t.after(() => server.close())

  const port = server.address().port
  const base = `http://127.0.0.1:${port}`

  const health = await fetch(`${base}/api/health`)
  assert.equal(health.status, 200)
  const h = await health.json()
  assert.equal(h.ok, true)

  const denied = await fetch(`${base}/api/diagnostics`)
  assert.equal(denied.status, 401)

  const ok = await fetch(`${base}/api/diagnostics`, {
    headers: { 'X-ACW-Token': 'integration-test-token' },
  })
  assert.equal(ok.status, 200)
  const d = await ok.json()
  assert.ok(d.version || d.platform)
})
