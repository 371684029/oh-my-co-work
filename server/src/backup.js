/**
 * M01 / M07：备份与 integrity_check
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { getDb, DATA_ROOT, ROOT, closeDb, checkSqliteFile, initDb } from './db.js'

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
  // 毫秒必须保留：同秒内两次备份（如 restore 的「恢复前备份」）会同名互相覆盖
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${String(d.getMilliseconds()).padStart(3, '0')}`
}

function resolveLiveDbPath() {
  const preferred = path.join(DATA_ROOT, 'oh-my-co-work.sqlite')
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
  const dbCopy = path.join(work, 'oh-my-co-work.sqlite')
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
    product: 'oh-my-co-work',
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

/**
 * 4.2.0：从 data/backups/ 恢复一份 tar.gz 备份。
 * 流程：恢复前自动再打一份「恢复前备份」→ 解包到 staging → integrity 校验 →
 * 关闭连接 → 现有数据挪到 aside 目录 → 拷入备份数据 → 重新 initDb（会顺带跑迁移链）。
 * backups/ 目录本身不在备份与恢复范围内（历史备份永远保留）。
 * @param {string} filename data/backups/ 下的备份文件名（acw-backup-*.tar.gz）
 * @param {{ initDb?: Function, checkSqliteFile?: Function }} [deps]
 * @returns {{ ok: true, restoredFrom: string, preRestore: { path: string }, aside: string }}
 */
export function restoreBackup(filename, deps = {}) {
  const name = path.basename(String(filename || ''))
  if (!/^acw-backup-[A-Za-z0-9._-]+\.tar\.gz$/.test(name)) {
    throw Object.assign(new Error('非法备份文件名'), { code: 'BAD_NAME' })
  }
  const archive = path.join(DATA_ROOT, 'backups', name)
  if (!fs.existsSync(archive)) {
    throw Object.assign(new Error('备份不存在'), { code: 'NO_BACKUP' })
  }

  const initDbFn = deps.initDb || initDb
  const checkSqlite = deps.checkSqliteFile || checkSqliteFile

  // 恢复前先打一份（integrity 失败会直接抛出，不动现有库）
  const pre = createBackup()

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-restore-'))
  try {
    execFileSync('tar', ['-xzf', archive, '-C', work], { stdio: 'pipe' })
  } catch (e) {
    fs.rmSync(work, { recursive: true, force: true })
    throw Object.assign(new Error(`备份解包失败：${e.message}`), { code: 'EXTRACT_FAIL' })
  }

  const stagedDb = path.join(work, 'oh-my-co-work.sqlite')
  if (!fs.existsSync(stagedDb)) {
    fs.rmSync(work, { recursive: true, force: true })
    throw Object.assign(new Error('备份内没有数据库文件'), { code: 'BAD_BACKUP' })
  }
  const check = checkSqlite(stagedDb)
  if (!check.ok) {
    fs.rmSync(work, { recursive: true, force: true })
    throw Object.assign(new Error(`备份库 integrity_check 失败：${check.detail}`), {
      code: 'INTEGRITY_FAIL',
    })
  }

  // 关闭现有连接后换库
  closeDb()

  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const aside = path.join(
    DATA_ROOT,
    'backups',
    `pre-restore-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`,
  )
  fs.mkdirSync(aside, { recursive: true })
  const moveAside = (rel) => {
    const src = path.join(DATA_ROOT, rel)
    if (fs.existsSync(src)) {
      fs.cpSync(src, path.join(aside, rel), { recursive: true })
      fs.rmSync(src, { recursive: true, force: true })
    }
  }
  moveAside('oh-my-co-work.sqlite')
  for (const suf of ['-wal', '-shm']) moveAside('oh-my-co-work.sqlite' + suf)
  moveAside('journals')
  moveAside('uploads')

  fs.copyFileSync(stagedDb, path.join(DATA_ROOT, 'oh-my-co-work.sqlite'))
  for (const suf of ['-wal', '-shm']) {
    if (fs.existsSync(stagedDb + suf)) fs.copyFileSync(stagedDb + suf, path.join(DATA_ROOT, 'oh-my-co-work.sqlite' + suf))
  }
  const stagedJournals = path.join(work, 'journals')
  if (fs.existsSync(stagedJournals)) {
    fs.cpSync(stagedJournals, path.join(DATA_ROOT, 'journals'), { recursive: true })
  }
  const stagedUploads = path.join(work, 'uploads')
  if (fs.existsSync(stagedUploads)) {
    fs.cpSync(stagedUploads, path.join(DATA_ROOT, 'uploads'), { recursive: true })
  }
  fs.rmSync(work, { recursive: true, force: true })

  initDbFn()
  return { ok: true, restoredFrom: name, preRestore: { path: pre.path }, aside }
}

/**
 * 4.2.0：列出 data/backups/ 下的 tar.gz 备份（新→旧），供恢复 UI 选择
 */
export function listBackups() {
  const dir = path.join(DATA_ROOT, 'backups')
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && /^acw-backup-[A-Za-z0-9._-]+\.tar\.gz$/.test(e.name))
    .map((e) => {
      const st = fs.statSync(path.join(dir, e.name))
      return { filename: e.name, bytes: st.size, mtimeMs: st.mtimeMs }
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
}
