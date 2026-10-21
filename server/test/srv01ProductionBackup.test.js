import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('SRV-01: HTTP update routes use async backup only', () => {
  const routes = fs.readFileSync(path.join(root, 'src/routes/updateRoutes.js'), 'utf8')
  assert.match(routes, /createBackupAsync/)
  assert.match(routes, /restoreBackupAsync/)
  assert.doesNotMatch(routes, /\bcreateBackup\s*\(/)
  assert.doesNotMatch(routes, /\brestoreBackup\s*\(/)
})

test('SRV-01: main routes use async createBackup', () => {
  const routes = fs.readFileSync(path.join(root, 'src/routes.js'), 'utf8')
  assert.match(routes, /createBackupAsync/)
  assert.doesNotMatch(routes, /\brestoreBackup\s*\(/)
})
