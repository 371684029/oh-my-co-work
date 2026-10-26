import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const smokePath = path.join(root, '..', 'scripts', 'ci-e2e-smoke.mjs')

// QA-01 regression tripwire (same grep-source style as e2eSmokeSpawnRoute.test.js):
// keeps ci-e2e-smoke.mjs covering the full-site routes — settings navigation +
// save round-trip, restore center, docs hub shell, multi-session workbench switch —
// and keeps the optional-playwright SKIP (exit 0) convention.
test('QA-01: ci-e2e-smoke keeps full-site route coverage and skip convention', () => {
  const src = fs.readFileSync(smokePath, 'utf8')

  // settings navigation + one save round-trip
  assert.match(src, /\/settings\/members/)
  assert.match(src, /\/settings\/prefs/)
  assert.match(src, /showDemo/)

  // restore center backup list
  assert.match(src, /\/settings\/restore/)
  assert.match(src, /restore-section/)

  // docs hub shell
  assert.match(src, /\/docs/)

  // multi-session workbench switch (second member + session)
  assert.match(src, /gotoWorkbenchSession/)

  // optional playwright dep: dynamic import + SKIP log + exit 0 path
  assert.match(src, /import\('playwright'\)/)
  assert.match(src, /SKIP browser steps/)

  // existing e2e gate still passed to the spawned server
  assert.match(src, /ACW_E2E_SMOKE/)
})
