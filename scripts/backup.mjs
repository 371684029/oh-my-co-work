#!/usr/bin/env node
/**
 * M01：备份 CLI
 * 用法：npm run backup
 * 输出：data/backups/acw-backup-*.tar.gz（含 sqlite 干净副本 + journals + uploads）
 */
import { initDb } from '../server/src/db.js'
import { createBackup, runIntegrityCheck } from '../server/src/backup.js'

initDb()
const check = runIntegrityCheck()
console.log('[acw] integrity_check:', check.detail)
const result = createBackup({ includeUploads: true })
console.log('[acw] backup ok:', result.path)
if (result.bytes != null) console.log('[acw] bytes:', result.bytes)
if (result.warning) console.warn('[acw]', result.warning)
