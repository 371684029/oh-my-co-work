import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('QA-01: e2e spawn-terminal route is gated by ACW_E2E_SMOKE', () => {
  const src = fs.readFileSync(path.join(root, 'src/routes/sessionsRoutes.js'), 'utf8')
  assert.match(src, /\/sessions\/:id\/e2e\/spawn-terminal/)
  assert.match(src, /ACW_E2E_SMOKE/)
})
