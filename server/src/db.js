import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(__dirname, '../..')
export const DATA_ROOT =
  process.env.ACW_DATA_ROOT || process.env.ECW_DATA_ROOT || path.join(ROOT, 'data')

let db
let dbDriver = 'better-sqlite3'

export function getDb() {
  if (!db) throw new Error('DB not initialized')
  return db
}

export function getDbDriver() {
  return dbDriver
}

/** Node 22+ 内置 sqlite，API 对齐 better-sqlite3 常用子集 */
function openNodeSqliteCompat(dbPath) {
  const { DatabaseSync } = require('node:sqlite')
  const raw = new DatabaseSync(dbPath)
  return {
    prepare(sql) {
      return raw.prepare(sql)
    },
    exec(sql) {
      return raw.exec(sql)
    },
    /**
     * 对齐 better-sqlite3：db.transaction(fn) 返回可调用函数。
     * 运行包在 ABI 不匹配回退 node:sqlite 时必须提供，否则 @/插队插入临时协助会报
     *「db2.transaction is not a function」。
     */
    transaction(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError('db.transaction(fn) requires a function')
      }
      return (...args) => {
        raw.exec('BEGIN')
        try {
          const result = fn(...args)
          raw.exec('COMMIT')
          return result
        } catch (e) {
          try {
            raw.exec('ROLLBACK')
          } catch {
            /* ignore */
          }
          throw e
        }
      }
    },
    pragma(src) {
      const body = String(src || '').trim()
      if (!body) return undefined
      const stmt = raw.prepare(`PRAGMA ${body}`)
      if (/=/.test(body)) {
        // journal_mode = WAL 等赋值
        try {
          return stmt.run()
        } catch {
          return stmt.get()
        }
      }
      try {
        return stmt.all()
      } catch {
        return stmt.get()
      }
    },
    close() {
      try {
        raw.close()
      } catch {
        /* ignore */
      }
    },
  }
}

function openDatabase(dbPath) {
  try {
    const Database = require('better-sqlite3')
    const inst = new Database(dbPath)
    dbDriver = 'better-sqlite3'
    return inst
  } catch (e) {
    const major = Number(String(process.versions.node || '0').split('.')[0])
    if (major >= 22) {
      console.warn(
        '[acw] better-sqlite3 不可用，回退 Node 内置 node:sqlite：',
        e?.message || e,
      )
      dbDriver = 'node:sqlite'
      return openNodeSqliteCompat(dbPath)
    }
    throw e
  }
}

function dbFileSize(p) {
  try {
    if (!fs.existsSync(p)) return 0
    let n = fs.statSync(p).size
    for (const suf of ['-wal', '-shm']) {
      const side = p + suf
      if (fs.existsSync(side)) n += fs.statSync(side).size
    }
    return n
  } catch {
    return 0
  }
}

/** 连带 wal/shm 改名；失败则原样返回 false */
function renameDbBundle(from, to) {
  if (!fs.existsSync(from)) return false
  if (fs.existsSync(to)) {
    // 目标已是更大/非空库：不要覆盖
    if (dbFileSize(to) >= dbFileSize(from) && dbFileSize(to) > 0) return true
    // 目标是空壳：删掉再迁
    try {
      for (const suf of ['', '-wal', '-shm']) {
        const t = to + suf
        if (fs.existsSync(t)) fs.unlinkSync(t)
      }
    } catch {
      return false
    }
  }
  try {
    fs.renameSync(from, to)
    for (const suf of ['-wal', '-shm']) {
      const f = from + suf
      const t = to + suf
      if (!fs.existsSync(f)) continue
      if (fs.existsSync(t)) fs.unlinkSync(t)
      fs.renameSync(f, t)
    }
    return true
  } catch (e) {
    console.warn('[acw] rename db failed:', e.message)
    return false
  }
}

/**
 * 优先 oh-my-co-work.sqlite；
 * 若新库不存在/为空壳，而旧库 element-co-work.sqlite 有数据，则迁入新名。
 */
function resolveDbPath() {
  const preferred = path.join(DATA_ROOT, 'oh-my-co-work.sqlite')
  const legacy = path.join(DATA_ROOT, 'element-co-work.sqlite')
  const prefSize = dbFileSize(preferred)
  const legSize = dbFileSize(legacy)

  if (legSize > 0 && (prefSize === 0 || legSize > prefSize)) {
    if (renameDbBundle(legacy, preferred)) {
      console.log('[acw] migrated sqlite: element-co-work.sqlite → oh-my-co-work.sqlite')
      return preferred
    }
    // 改名失败（文件占用等）：仍打开有数据的旧库，避免空白库
    console.warn('[acw] using legacy sqlite (rename blocked):', legacy)
    return legacy
  }
  if (prefSize > 0 || fs.existsSync(preferred)) return preferred
  if (fs.existsSync(legacy)) return legacy
  return preferred
}

export function initDb() {
  fs.mkdirSync(DATA_ROOT, { recursive: true })
  fs.mkdirSync(path.join(DATA_ROOT, 'logs'), { recursive: true })
  fs.mkdirSync(path.join(DATA_ROOT, 'journals'), { recursive: true })
  fs.mkdirSync(path.join(DATA_ROOT, 'uploads'), { recursive: true })

  const dbPath = resolveDbPath()
  console.log('[acw] sqlite', dbPath)
  db = openDatabase(dbPath)
  console.log('[acw] sqlite driver', dbDriver)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // M07：启动 integrity_check（失败只告警，仍允许启动以便备份抢救）
  try {
    const rows = db.pragma('integrity_check')
    const detail = Array.isArray(rows)
      ? rows.map((r) => (r && r.integrity_check != null ? r.integrity_check : String(r))).join('; ')
      : String(rows)
    if (detail !== 'ok' && !/^ok$/i.test(String(detail).trim())) {
      console.error('[acw] SQLITE integrity_check FAILED:', detail)
      console.error('[acw] 建议立即执行: npm run backup（若仍可读）并检查 data/ 目录')
    } else {
      console.log('[acw] integrity_check ok')
    }
  } catch (e) {
    console.warn('[acw] integrity_check error', e?.message || e)
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      kind TEXT NOT NULL,
      work_folder TEXT,
      config_json TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 1,
      cloned_from_id TEXT,
      clone_generation INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      work_folder TEXT,
      steps_json TEXT NOT NULL DEFAULT '[]',
      enabled INTEGER NOT NULL DEFAULT 1,
      cloned_from_id TEXT,
      clone_generation INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      current_step_index INTEGER NOT NULL DEFAULT 0,
      context_json TEXT NOT NULL DEFAULT '{}',
      archive_reason TEXT,
      archived_at TEXT,
      pinned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (group_id) REFERENCES groups(id)
    );

    CREATE TABLE IF NOT EXISTS node_instances (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      step_id TEXT NOT NULL,
      title TEXT NOT NULL,
      step_type TEXT NOT NULL,
      member_id TEXT,
      status TEXT NOT NULL,
      gate INTEGER NOT NULL DEFAULT 0,
      input_json TEXT,
      output_json TEXT,
      journal_path TEXT,
      started_at TEXT,
      finished_at TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      node_instance_id TEXT,
      role TEXT NOT NULL,
      member_id TEXT,
      type TEXT NOT NULL DEFAULT 'text',
      content_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS terminal_sessions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      node_instance_id TEXT,
      member_id TEXT,
      run_id TEXT,
      status TEXT NOT NULL,
      cwd TEXT,
      command_label TEXT,
      pid INTEGER,
      cols INTEGER,
      rows INTEGER,
      log_path TEXT,
      exit_code INTEGER,
      signal TEXT,
      started_at TEXT,
      finished_at TEXT
    );
  `)

  const row = db.prepare('SELECT version FROM schema_version LIMIT 1').get()
  if (!row) {
    db.prepare('INSERT INTO schema_version (version) VALUES (1)').run()
  }

  runMigrations(db)

  return db
}

/**
 * 4.2.0 schema 迁移链：按 schema_version 单调推进，事务包裹、幂等、失败即停。
 * 历史上的 ad-hoc ALTER 收敛为 v2/v3 两步（列存在性检查保证幂等）。
 */
const MIGRATIONS = [
  {
    version: 2,
    name: 'node_instances input_json/journal_path',
    up: (db) => {
      const cols = db.prepare(`PRAGMA table_info(node_instances)`).all().map((c) => c.name)
      if (!cols.includes('input_json')) {
        db.exec(`ALTER TABLE node_instances ADD COLUMN input_json TEXT`)
      }
      if (!cols.includes('journal_path')) {
        db.exec(`ALTER TABLE node_instances ADD COLUMN journal_path TEXT`)
      }
    },
  },
  {
    version: 3,
    name: 'groups config_json',
    up: (db) => {
      const gcols = db.prepare(`PRAGMA table_info(groups)`).all().map((c) => c.name)
      if (!gcols.includes('config_json')) {
        db.exec(`ALTER TABLE groups ADD COLUMN config_json TEXT NOT NULL DEFAULT '{}'`)
      }
    },
  },
]

function runMigrations(db) {
  let current = db.prepare('SELECT version FROM schema_version LIMIT 1').get()?.version ?? 1
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue
    const run = db.transaction(() => {
      m.up(db)
      db.prepare('UPDATE schema_version SET version = ?').run(m.version)
    })
    try {
      run()
    } catch (e) {
      throw Object.assign(
        new Error(`数据库迁移失败 v${m.version}（${m.name}）：${e.message}；请用 data/backups/ 内备份恢复`),
        { code: 'MIGRATION_FAIL' },
      )
    }
    current = m.version
  }
}

/** 关闭当前连接（restore 换库前必须）；未初始化时静默 */
export function closeDb() {
  try {
    db?.close?.()
  } catch {
    /* ignore */
  }
  db = undefined
}

/**
 * 校验一个独立 sqlite 文件的完整性（restore 前的 staging 检查），不占用全局连接
 */
export function checkSqliteFile(dbPath) {
  let probe
  try {
    probe = openDatabase(dbPath)
    const rows = probe.pragma('integrity_check')
    const detail = Array.isArray(rows)
      ? rows.map((r) => (r && r.integrity_check != null ? r.integrity_check : String(r))).join('; ')
      : String(rows)
    const ok = detail === 'ok' || /^ok$/i.test(String(detail).trim())
    return { ok, detail }
  } catch (e) {
    // 非法文件（file is not a database）也按完整性失败处理，而非抛出
    return { ok: false, detail: e.message }
  } finally {
    try {
      probe?.close?.()
    } catch {
      /* ignore */
    }
  }
}

export function parseJson(text, fallback = null) {
  if (text == null || text === '') return fallback
  try {
    const v = JSON.parse(text)
    return v == null ? fallback : v
  } catch {
    return fallback
  }
}
