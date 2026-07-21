/**
 * M01 / M07：备份与 integrity_check
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { getDb, DATA_ROOT, ROOT } from './db.js'

/**
 * @returns {{ ok: boolean, detail: string }}
 */
export function runIntegrityCheck() {
  const db = getDb()
  const rows = db.pragma('integrity_check')
  const detail = Array.isArray(rows)
    ? rows.map((r) => (r && r.integrity_check != null ? r.integrity_check : String(r))).join('; ')
    : String(rows)
  const ok = detail === 'ok' || /^ok$/i.test(detail.trim())
  return { ok, detail }
}

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function resolveLiveDbPath() {
  const preferred = path.join(DATA_ROOT, 'apple-co-work.sqlite')
  const legacy = path.join(DATA_ROOT, 'element-co-work.sqlite')
  if (fs.existsSync(preferred)) return preferred
  if (fs.existsSync(legacy)) return legacy
  return preferred
}

/**
 * 导出 tar.gz：sqlite（checkpoint 后拷贝）+ journals + uploads
 * @param {{ outDir?: string, includeUploads?: boolean }} [opts]
 */
export function createBackup(opts = {}) {
  const integrity = runIntegrityCheck()
  if (!integrity.ok) {
    throw Object.assign(new Error(`SQLite integrity_check 失败：${integrity.detail}`), {
      code: 'INTEGRITY_FAIL',
      detail: integrity.detail,
    })
  }

  try {
    getDb().pragma('wal_checkpoint(TRUNCATE)')
  } catch (e) {
    console.warn('[acw] wal_checkpoint', e?.message || e)
  }

  const outDir = opts.outDir || path.join(DATA_ROOT, 'backups')
  fs.mkdirSync(outDir, { recursive: true })
  const name = `acw-backup-${stamp()}`
  const work = path.join(outDir, `.${name}-work`)
  if (fs.existsSync(work)) fs.rmSync(work, { recursive: true, force: true })
  fs.mkdirSync(work, { recursive: true })

  const liveDb = resolveLiveDbPath()
  const dbCopy = path.join(work, 'apple-co-work.sqlite')
  if (!fs.existsSync(liveDb)) {
    throw Object.assign(new Error(`找不到数据库文件: ${liveDb}`), { code: 'NO_DB' })
  }
  fs.copyFileSync(liveDb, dbCopy)
  // checkpoint 后通常无 wal/shm；若仍有则一并拷
  for (const suf of ['-wal', '-shm']) {
    const side = liveDb + suf
    if (fs.existsSync(side) && fs.statSync(side).size > 0) {
      fs.copyFileSync(side, dbCopy + suf)
    }
  }

  const journalsSrc = path.join(DATA_ROOT, 'journals')
  const journalsDst = path.join(work, 'journals')
  if (fs.existsSync(journalsSrc)) {
    fs.cpSync(journalsSrc, journalsDst, { recursive: true })
  } else {
    fs.mkdirSync(journalsDst, { recursive: true })
  }

  if (opts.includeUploads !== false) {
    const upSrc = path.join(DATA_ROOT, 'uploads')
    const upDst = path.join(work, 'uploads')
    if (fs.existsSync(upSrc)) {
      fs.cpSync(upSrc, upDst, { recursive: true })
    }
  }

  const meta = {
    createdAt: new Date().toISOString(),
    product: 'apple-co-work',
    dataRoot: DATA_ROOT,
    repoRoot: ROOT,
    integrity: integrity.detail,
    sourceDb: liveDb,
  }
  fs.writeFileSync(path.join(work, 'backup-meta.json'), JSON.stringify(meta, null, 2), 'utf8')

  const archivePath = path.join(outDir, `${name}.tar.gz`)
  try {
    const entries = fs.readdirSync(work)
    execFileSync('tar', ['-czf', archivePath, '-C', work, ...entries], { stdio: 'pipe' })
  } catch (e) {
    const dirBackup = path.join(outDir, name)
    if (fs.existsSync(dirBackup)) fs.rmSync(dirBackup, { recursive: true, force: true })
    fs.renameSync(work, dirBackup)
    return {
      ok: true,
      path: dirBackup,
      format: 'dir',
      integrity: integrity.detail,
      warning: `tar 不可用（${e.message}），已输出目录备份`,
    }
  }

  fs.rmSync(work, { recursive: true, force: true })
  const size = fs.statSync(archivePath).size
  return {
    ok: true,
    path: archivePath,
    format: 'tar.gz',
    bytes: size,
    integrity: integrity.detail,
  }
}
