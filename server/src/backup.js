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
 * 支持指定目标路径 targetPath（文件夹或具体文件）与源路径 sourcePath（文件或文件夹）
 * @param {{ outDir?: string, targetPath?: string, sourcePath?: string, includeUploads?: boolean }} [opts]
 */
export function createBackup(opts = {}) {
  let integrityDetail = 'ok'
  const sourcePath = opts.sourcePath ? path.resolve(String(opts.sourcePath).trim()) : null

  if (sourcePath) {
    if (!fs.existsSync(sourcePath)) {
      throw Object.assign(new Error(`备份源路径不存在：${sourcePath}`), { code: 'NO_SOURCE' })
    }
  } else {
    const integrity = runIntegrityCheck()
    if (!integrity.ok) {
      throw Object.assign(new Error(`SQLite integrity_check 失败：${integrity.detail}`), {
        code: 'INTEGRITY_FAIL',
        detail: integrity.detail,
      })
    }
    integrityDetail = integrity.detail
    try {
      getDb().pragma('wal_checkpoint(TRUNCATE)')
    } catch (e) {
      console.warn('[acw] wal_checkpoint', e?.message || e)
    }
  }

  // 计算输出目录与最终归档文件路径
  let outDir = path.join(DATA_ROOT, 'backups')
  let specificFile = null
  if (opts.targetPath) {
    const tp = path.resolve(String(opts.targetPath).trim())
    if (fs.existsSync(tp)) {
      const st = fs.statSync(tp)
      if (st.isDirectory()) {
        outDir = tp
      } else {
        outDir = path.dirname(tp)
        specificFile = tp
      }
    } else {
      if (tp.endsWith(path.sep) || tp.endsWith('/') || tp.endsWith('\\') || !path.extname(tp)) {
        outDir = tp
      } else {
        outDir = path.dirname(tp)
        specificFile = tp
      }
    }
  } else if (opts.outDir) {
    outDir = path.resolve(opts.outDir)
  }

  fs.mkdirSync(outDir, { recursive: true })
  const name = `acw-backup-${stamp()}`
  const work = path.join(outDir, `.${name}-work`)
  if (fs.existsSync(work)) fs.rmSync(work, { recursive: true, force: true })
  fs.mkdirSync(work, { recursive: true })

  let sourceDb = null
  if (sourcePath) {
    const st = fs.statSync(sourcePath)
    if (st.isFile()) {
      const isSqlite = /\.(?:sqlite|db|sqlite3)$/i.test(sourcePath)
      if (isSqlite) {
        const check = checkSqliteFile(sourcePath)
        if (!check.ok) {
          fs.rmSync(work, { recursive: true, force: true })
          throw Object.assign(new Error(`源数据库 integrity_check 失败：${check.detail}`), {
            code: 'INTEGRITY_FAIL',
            detail: check.detail,
          })
        }
        integrityDetail = check.detail
        sourceDb = sourcePath
        const dbCopy = path.join(work, 'oh-my-co-work.sqlite')
        fs.copyFileSync(sourcePath, dbCopy)
        for (const suf of ['-wal', '-shm']) {
          const side = sourcePath + suf
          if (fs.existsSync(side) && fs.statSync(side).size > 0) {
            fs.copyFileSync(side, dbCopy + suf)
          }
        }
      }
      // 原样也保留一份文件
      fs.copyFileSync(sourcePath, path.join(work, path.basename(sourcePath)))
    } else if (st.isDirectory()) {
      fs.cpSync(sourcePath, work, { recursive: true })
      // 检查目录内是否有 sqlite 文件进行校验
      try {
        const found = fs.readdirSync(work).find((f) => /\.(?:sqlite|db|sqlite3)$/i.test(f))
        if (found) {
          const full = path.join(work, found)
          const check = checkSqliteFile(full)
          if (check.ok) integrityDetail = check.detail
          sourceDb = full
        }
      } catch {
        /* ignore */
      }
    }
  } else {
    const liveDb = resolveLiveDbPath()
    sourceDb = liveDb
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
  }

  const meta = {
    createdAt: new Date().toISOString(),
    product: 'oh-my-co-work',
    dataRoot: DATA_ROOT,
    repoRoot: ROOT,
    integrity: integrityDetail,
    sourceDb,
    sourcePath: sourcePath || null,
  }
  fs.writeFileSync(path.join(work, 'backup-meta.json'), JSON.stringify(meta, null, 2), 'utf8')

  const archivePath = specificFile || path.join(outDir, `${name}.tar.gz`)
  try {
    const entries = fs.readdirSync(work)
    execFileSync('tar', ['-czf', archivePath, '-C', work, ...entries], { stdio: 'pipe' })
  } catch (e) {
    const dirBackup = specificFile
      ? specificFile.replace(/\.tar\.gz$/i, '')
      : path.join(outDir, name)
    if (fs.existsSync(dirBackup)) fs.rmSync(dirBackup, { recursive: true, force: true })
    fs.renameSync(work, dirBackup)
    return {
      ok: true,
      path: dirBackup,
      format: 'dir',
      integrity: integrityDetail,
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
    integrity: integrityDetail,
  }
}

const BACKUP_NAME_RE = /^acw-backup-[A-Za-z0-9._-]+(?:\.tar\.gz)?$/
const LIVE_RELS = [
  'oh-my-co-work.sqlite',
  'oh-my-co-work.sqlite-wal',
  'oh-my-co-work.sqlite-shm',
  'element-co-work.sqlite',
  'element-co-work.sqlite-wal',
  'element-co-work.sqlite-shm',
  'journals',
  'uploads',
]

function dirBytes(p) {
  let n = 0
  try {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const fp = path.join(p, e.name)
      if (e.isFile()) n += fs.statSync(fp).size
      else if (e.isDirectory()) n += dirBytes(fp)
    }
  } catch {
    /* ignore */
  }
  return n
}

function resolveBackupEntry(name) {
  const dir = path.join(DATA_ROOT, 'backups')
  if (name.endsWith('.tar.gz')) {
    const archive = path.join(dir, name)
    if (fs.existsSync(archive) && fs.statSync(archive).isFile()) {
      return { kind: 'tar', path: archive, id: name }
    }
  } else {
    const folder = path.join(dir, name)
    if (fs.existsSync(folder) && fs.statSync(folder).isDirectory()) {
      return { kind: 'dir', path: folder, id: name }
    }
    const archive = path.join(dir, `${name}.tar.gz`)
    if (fs.existsSync(archive) && fs.statSync(archive).isFile()) {
      return { kind: 'tar', path: archive, id: `${name}.tar.gz` }
    }
  }
  return null
}

function resolveRestoreTarget(target) {
  const raw = String(target || '').trim()
  if (!raw) {
    throw Object.assign(new Error('未指定备份文件或文件夹'), { code: 'BAD_NAME' })
  }

  // 若不含路径分隔符，优先走内置 backups 目录校验
  if (!/[/\\]/.test(raw)) {
    if (BACKUP_NAME_RE.test(raw)) {
      const entry = resolveBackupEntry(raw)
      if (!entry) throw Object.assign(new Error('备份不存在'), { code: 'NO_BACKUP' })
      return entry
    }
    const entry = resolveBackupEntry(raw)
    if (entry) return entry
    throw Object.assign(new Error('非法备份文件名'), { code: 'BAD_NAME' })
  }

  // 包含路径分隔符：绝对或相对路径
  // 校验文件名与后缀安全性
  const ext = path.extname(raw).toLowerCase()
  if (ext && !['.gz', '.tar', '.tgz', '.sqlite', '.sqlite3', '.db'].includes(ext)) {
    throw Object.assign(new Error('非法备份文件名'), { code: 'BAD_NAME' })
  }

  const resolved = path.resolve(raw)
  if (!fs.existsSync(resolved)) {
    // 尝试在 DATA_ROOT/backups 下匹配 basename
    const base = path.basename(raw)
    const entry = resolveBackupEntry(base)
    if (entry) return entry
    throw Object.assign(new Error('非法备份文件名：备份不存在'), { code: 'NO_BACKUP' })
  }

  const st = fs.statSync(resolved)
  if (st.isDirectory()) {
    return { kind: 'dir', path: resolved, id: path.basename(resolved) }
  }
  if (st.isFile()) {
    if (/\.(?:tar\.gz|tgz|tar)$/i.test(resolved)) {
      return { kind: 'tar', path: resolved, id: path.basename(resolved) }
    }
    if (/\.(?:sqlite|db|sqlite3)$/i.test(resolved)) {
      return { kind: 'sqlite_file', path: resolved, id: path.basename(resolved) }
    }
    throw Object.assign(
      new Error('非法备份文件名：请选择 .tar.gz 压缩包、.sqlite 数据库文件或备份目录'),
      { code: 'BAD_NAME' },
    )
  }

  throw Object.assign(new Error('非法备份文件名'), { code: 'BAD_NAME' })
}

function applyStagedToLive(work) {
  let stagedDb = path.join(work, 'oh-my-co-work.sqlite')
  if (!fs.existsSync(stagedDb)) {
    const legacy = path.join(work, 'element-co-work.sqlite')
    if (fs.existsSync(legacy)) {
      stagedDb = legacy
    } else {
      try {
        const found = fs.readdirSync(work).find((f) => /\.(?:sqlite|db|sqlite3)$/i.test(f))
        if (found) stagedDb = path.join(work, found)
      } catch {
        /* ignore */
      }
    }
  }
  if (stagedDb && fs.existsSync(stagedDb)) {
    fs.copyFileSync(stagedDb, path.join(DATA_ROOT, 'oh-my-co-work.sqlite'))
    for (const suf of ['-wal', '-shm']) {
      if (fs.existsSync(stagedDb + suf)) {
        fs.copyFileSync(stagedDb + suf, path.join(DATA_ROOT, 'oh-my-co-work.sqlite' + suf))
      }
    }
  }
  const stagedJournals = path.join(work, 'journals')
  if (fs.existsSync(stagedJournals)) {
    fs.cpSync(stagedJournals, path.join(DATA_ROOT, 'journals'), { recursive: true })
  }
  const stagedUploads = path.join(work, 'uploads')
  if (fs.existsSync(stagedUploads)) {
    fs.cpSync(stagedUploads, path.join(DATA_ROOT, 'uploads'), { recursive: true })
  }
}

function restoreFromAside(aside) {
  for (const rel of LIVE_RELS) {
    const live = path.join(DATA_ROOT, rel)
    if (fs.existsSync(live)) fs.rmSync(live, { recursive: true, force: true })
  }
  if (!aside || !fs.existsSync(aside)) return
  for (const name of fs.readdirSync(aside)) {
    fs.cpSync(path.join(aside, name), path.join(DATA_ROOT, name), { recursive: true })
  }
}

/**
 * 4.2.0+：从指定备份文件或文件夹恢复。
 * 支持：data/backups/ 下的历史备份名、本机任意 .tar.gz 压缩包、.sqlite 数据库文件或备份目录。
 * 流程：恢复前自动再打一份「恢复前备份」→ 解包/定位 staging → integrity 校验 →
 * 关闭连接 → 现有数据挪到 aside 目录 → 拷入备份数据 → 重新 initDb（会顺带跑迁移链）。
 * 拷入失败时从 aside 回滚再 initDb，避免活库被搬走后落空。
 * @param {string} filenameOrPath 备份文件名或本地文件/文件夹路径
 * @param {{ initDb?: Function, checkSqliteFile?: Function, applyLive?: Function }} [deps]
 * @returns {{ ok: true, restoredFrom: string, preRestore: { path: string }, aside: string }}
 */
export function restoreBackup(filenameOrPath, deps = {}) {
  const entry = resolveRestoreTarget(filenameOrPath)

  const initDbFn = deps.initDb || initDb
  const checkSqlite = deps.checkSqliteFile || checkSqliteFile
  const applyLive = deps.applyLive || applyStagedToLive

  // 恢复前先打一份（integrity 失败会直接抛出，不动现有库）
  const pre = createBackup()

  let work = null
  let ownWork = false
  if (entry.kind === 'tar') {
    work = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-restore-'))
    ownWork = true
    try {
      execFileSync('tar', ['-xzf', entry.path, '-C', work], { stdio: 'pipe' })
    } catch (e) {
      fs.rmSync(work, { recursive: true, force: true })
      throw Object.assign(new Error(`备份解包失败：${e.message}`), { code: 'EXTRACT_FAIL' })
    }
  } else if (entry.kind === 'sqlite_file') {
    work = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-restore-'))
    ownWork = true
    const stagedDb = path.join(work, 'oh-my-co-work.sqlite')
    fs.copyFileSync(entry.path, stagedDb)
    for (const suf of ['-wal', '-shm']) {
      const side = entry.path + suf
      if (fs.existsSync(side) && fs.statSync(side).size > 0) {
        fs.copyFileSync(side, stagedDb + suf)
      }
    }
  } else {
    work = entry.path
  }

  let stagedDb = path.join(work, 'oh-my-co-work.sqlite')
  if (!fs.existsSync(stagedDb)) {
    const legacy = path.join(work, 'element-co-work.sqlite')
    if (fs.existsSync(legacy)) {
      stagedDb = legacy
    } else {
      try {
        const found = fs.readdirSync(work).find((f) => /\.(?:sqlite|db|sqlite3)$/i.test(f))
        if (found) stagedDb = path.join(work, found)
      } catch {
        /* ignore */
      }
    }
  }

  if (!fs.existsSync(stagedDb)) {
    if (ownWork) fs.rmSync(work, { recursive: true, force: true })
    throw Object.assign(new Error('备份内没有数据库文件'), { code: 'BAD_BACKUP' })
  }
  const check = checkSqlite(stagedDb)
  if (!check.ok) {
    if (ownWork) fs.rmSync(work, { recursive: true, force: true })
    throw Object.assign(new Error(`备份库 integrity_check 失败：${check.detail}`), {
      code: 'INTEGRITY_FAIL',
    })
  }

  closeDb()

  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const aside = path.join(
    DATA_ROOT,
    'backups',
    `pre-restore-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`,
  )
  fs.mkdirSync(aside, { recursive: true })
  const moveAside = (rel) => {
    const src = path.join(DATA_ROOT, rel)
    if (fs.existsSync(src)) {
      fs.cpSync(src, path.join(aside, rel), { recursive: true })
      fs.rmSync(src, { recursive: true, force: true })
    }
  }

  try {
    for (const rel of LIVE_RELS) moveAside(rel)
    applyLive(work)
    initDbFn()
    return { ok: true, restoredFrom: entry.id, preRestore: { path: pre.path }, aside }
  } catch (err) {
    try {
      restoreFromAside(aside)
    } catch (rb) {
      console.warn('[acw] restore rollback', rb?.message || rb)
    }
    try {
      initDbFn()
    } catch (reopen) {
      console.warn('[acw] restore reinit', reopen?.message || reopen)
    }
    throw err
  } finally {
    if (ownWork && work) {
      try {
        fs.rmSync(work, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * 4.2.0：列出 data/backups/ 下的 tar.gz 与目录备份（新→旧），供恢复 UI 选择。
 * tar 失败时 createBackup 会留下 acw-backup-* 目录，必须能列出并恢复。
 */
export function listBackups() {
  const dir = path.join(DATA_ROOT, 'backups')
  if (!fs.existsSync(dir)) return []
  const items = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue
    const abs = path.join(dir, e.name)
    if (e.isFile() && /^acw-backup-[A-Za-z0-9._-]+\.tar\.gz$/.test(e.name)) {
      const st = fs.statSync(abs)
      items.push({ filename: e.name, bytes: st.size, mtimeMs: st.mtimeMs, format: 'tar.gz' })
    } else if (e.isDirectory() && /^acw-backup-[A-Za-z0-9._-]+$/.test(e.name)) {
      const st = fs.statSync(abs)
      items.push({ filename: e.name, bytes: dirBytes(abs), mtimeMs: st.mtimeMs, format: 'dir' })
    }
  }
  return items.sort((a, b) => b.mtimeMs - a.mtimeMs)
}
