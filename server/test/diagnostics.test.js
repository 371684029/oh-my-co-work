import assert from 'node:assert/strict'
import test from 'node:test'
import { collectDiagnostics } from '../src/diagnostics.js'

test('collectDiagnostics returns version and platform', () => {
  const d = collectDiagnostics()
  assert.ok(d.collectedAt)
  assert.ok(d.version)
  assert.ok(d.platform)
  assert.ok(d.settings && typeof d.settings === 'object')
})
