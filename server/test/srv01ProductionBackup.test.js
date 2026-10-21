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

test('SRV-01: sync restore rollback still uses sync createBackup (test/legacy boundary)', () => {
  const backup = fs.readFileSync(path.join(root, 'src/backup.js'), 'utf8')
  const start = backup.indexOf('function restoreBackupUnlocked(')
  const end = backup.indexOf('export function restoreBackup', start + 1)
  const syncBlock = backup.slice(start, end > start ? end : start + 4000)
  assert.match(syncBlock, /\bcreateBackup\s*\(\)/)
  assert.doesNotMatch(syncBlock, /createBackupAsync/)
})

test('SRV-01: async restore path pre-backup uses createBackupAsync', () => {
  const backup = fs.readFileSync(path.join(root, 'src/backup.js'), 'utf8')
  const start = backup.indexOf('async function restoreBackupUnlockedAsync')
  const end = backup.indexOf('function restoreBackupUnlocked(', start)
  const asyncBlock = backup.slice(start, end)
  assert.match(asyncBlock, /await createBackupAsync\(\)/)
  assert.doesNotMatch(asyncBlock, /\bcreateBackup\s*\(\)/)
})
