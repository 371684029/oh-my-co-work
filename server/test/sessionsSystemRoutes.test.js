import test from 'node:test'
import assert from 'node:assert/strict'
import sessionsSystemRoutes from '../src/routes/sessionsSystemRoutes.js'

test('sessionsSystemRoutes registers diagnostics and agent-registry', () => {
  const stack = sessionsSystemRoutes.stack || []
  const paths = stack.map((l) => l.route?.path).filter(Boolean)
  assert.ok(paths.includes('/diagnostics'))
  assert.ok(paths.includes('/agent-registry'))
  assert.ok(paths.includes('/templates/builtin'))
})
