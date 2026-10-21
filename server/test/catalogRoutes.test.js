import test from 'node:test'
import assert from 'node:assert/strict'
import catalogRoutes from '../src/routes/catalogRoutes.js'

test('catalogRoutes registers members and groups list handlers', () => {
  const stack = catalogRoutes.stack || []
  const paths = stack.map((l) => l.route?.path).filter(Boolean)
  assert.ok(paths.includes('/members'))
  assert.ok(paths.includes('/groups'))
})
