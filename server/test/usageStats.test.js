import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-usage-'))
process.env.ACW_DATA_ROOT = dataRoot

const { initDb } = await import('../src/db.js')
const { collectUsageStats } = await import('../src/usageStats.js')

initDb()

test('collectUsageStats returns shape', () => {
  const s = collectUsageStats()
  assert.ok(s.collectedAt)
  assert.ok(s.sessions)
  assert.ok(Array.isArray(s.byMember))
})
