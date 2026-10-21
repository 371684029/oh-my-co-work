#!/usr/bin/env node
/**
 * SRV-01: async restore CLI (non-blocking tar extract; same path as HTTP POST /api/update/restore).
 * Usage: node scripts/restore-backup.mjs <acw-backup-*.tar.gz|dir>
 */
import { initDb, closeDb } from '../server/src/db.js'
import { listBackups, restoreBackupAsync, runIntegrityCheck } from '../server/src/backup.js'

const name = process.argv[2]
if (!name) {
  console.error('[acw] usage: node scripts/restore-backup.mjs <backup-filename>')
  console.error('[acw] available:', listBackups().map((b) => b.filename).join(', ') || '(none)')
  process.exit(1)
}

initDb()
const check = runIntegrityCheck()
console.log('[acw] integrity_check (before):', check.detail)

try {
  const result = await restoreBackupAsync(name)
  console.log('[acw] restore ok from:', result.restoredFrom)
  if (result.preRestore?.path) console.log('[acw] pre-restore backup:', result.preRestore.path)
  const after = runIntegrityCheck()
  console.log('[acw] integrity_check (after):', after.detail)
} catch (e) {
  console.error('[acw] restore failed:', e.message || e)
  process.exitCode = 1
} finally {
  closeDb?.()
}
