import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

// 4.2.0 schema 迁移链：旧 v1 库升级到当前版本、幂等、失败停住。
// 本文件在 import db.js 之前手工构造一个「旧版 schema」数据库。

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-migration-'))
process.env.ACW_DATA_ROOT = dataRoot

// 用 better-sqlite3 直接构造 v1 时代的库：无 input_json/journal_path/config_json
const Database = (await import('better-sqlite3')).default
const legacyPath = path.join(dataRoot, 'oh-my-co-work.sqlite')
const legacy = new Database(legacyPath)
legacy.exec(`
  CREATE TABLE schema_version (version INTEGER NOT NULL);
  INSERT INTO schema_version (version) VALUES (1);
  CREATE TABLE members (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, display_name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'echo', work_folder TEXT, config_json TEXT NOT NULL DEFAULT '{}',
    enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT, updated_at TEXT
  );
  CREATE TABLE groups (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT,
    work_folder TEXT, steps_json TEXT NOT NULL DEFAULT '[]', enabled INTEGER NOT NULL DEFAULT 1,
    cloned_from_id TEXT, clone_generation INTEGER NOT NULL DEFAULT 0, created_at TEXT, updated_at TEXT
  );
  CREATE TABLE sessions (
    id TEXT PRIMARY KEY, group_id TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL,
    current_step_index INTEGER NOT NULL DEFAULT 0, context_json TEXT NOT NULL DEFAULT '{}',
    archive_reason TEXT, archived_at TEXT, pinned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT, updated_at TEXT
  );
  CREATE TABLE node_instances (
    id TEXT PRIMARY KEY, session_id TEXT NOT NULL, step_index INTEGER NOT NULL,
    step_id TEXT, title TEXT, step_type TEXT, member_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending', gate INTEGER NOT NULL DEFAULT 0,
    output_json TEXT, started_at TEXT, finished_at TEXT
  );
  CREATE TABLE messages (
    id TEXT PRIMARY KEY, session_id TEXT NOT NULL, node_instance_id TEXT,
    role TEXT NOT NULL, member_id TEXT, type TEXT NOT NULL DEFAULT 'text',
    content_json TEXT NOT NULL DEFAULT '{}', created_at TEXT
  );
  CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE terminal_sessions (
    id TEXT PRIMARY KEY, session_id TEXT, status TEXT, rows INTEGER, log_path TEXT,
    exit_code INTEGER, signal TEXT, started_at TEXT, finished_at TEXT
  );
`)
legacy.close()

const { initDb, getDb } = await import('../src/db.js')
initDb()

test('legacy v1 database migrates to the current schema version', () => {
  const row = getDb().prepare('SELECT version FROM schema_version LIMIT 1').get()
  assert.ok(row.version >= 3, `expected >= 3, got ${row.version}`)

  const nCols = getDb().prepare('PRAGMA table_info(node_instances)').all().map((c) => c.name)
  assert.equal(nCols.includes('input_json'), true)
  assert.equal(nCols.includes('journal_path'), true)
  const gCols = getDb().prepare('PRAGMA table_info(groups)').all().map((c) => c.name)
  assert.equal(gCols.includes('config_json'), true)
})

test('re-running initDb is idempotent (no version bump, no error)', () => {
  const before = getDb().prepare('SELECT version FROM schema_version LIMIT 1').get().version
  initDb()
  const after = getDb().prepare('SELECT version FROM schema_version LIMIT 1').get().version
  assert.equal(after, before)
})

test('fresh database also lands on the current schema version', () => {
  // 同进程内验证迁移链对空 schema_version 表也成立：清空版本行后重跑
  getDb().prepare('DELETE FROM schema_version').run()
  initDb()
  const row = getDb().prepare('SELECT version FROM schema_version LIMIT 1').get()
  assert.ok(row.version >= 3)
  assert.equal(fs.existsSync(dataRoot), true)
})
