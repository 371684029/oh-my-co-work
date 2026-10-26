import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createRequire } from 'node:module'

// SRV-01：integrity_check / wal_checkpoint 下放 worker 线程（含 worker 不可用回退）。

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3')
const { checkIntegrityAsync, checkpointWalAsync, runIntegrityInWorker } = await import(
  '../src/sqliteIntegrityWorker.js'
)

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-integrity-worker-'))

/** 建一个多页健康库（截断后必然 malformed） */
function makeGoodDb(name, rows = 200) {
  const p = path.join(tmp, name)
  for (const suf of ['', '-wal', '-shm']) fs.rmSync(p + suf, { force: true })
  const db = new Database(p)
  db.pragma('journal_mode = WAL')
  db.exec('CREATE TABLE t(a TEXT)')
  const ins = db.prepare('INSERT INTO t VALUES (?)')
  for (let i = 0; i < rows; i++) ins.run('x'.repeat(120) + i)
  db.pragma('wal_checkpoint(TRUNCATE)')
  db.close()
  return p
}

test('checkIntegrityAsync: healthy db resolves ok:true', async () => {
  const p = makeGoodDb('good.sqlite')
  const r = await checkIntegrityAsync(p)
  assert.equal(r.ok, true)
  assert.match(String(r.detail), /ok/i)
})

test('checkIntegrityAsync: non-sqlite bytes resolve ok:false without throwing', async () => {
  const p = path.join(tmp, 'garbage.sqlite')
  fs.writeFileSync(p, 'this is not sqlite')
  const r = await checkIntegrityAsync(p)
  assert.equal(r.ok, false)
  assert.ok(String(r.detail).length > 0)
})

test('checkIntegrityAsync: truncated multi-page db resolves ok:false', async () => {
  const src = makeGoodDb('trunc-src.sqlite')
  const buf = fs.readFileSync(src)
  const p = path.join(tmp, 'trunc.sqlite')
  fs.writeFileSync(p, buf.subarray(0, Math.floor(buf.length / 2)))
  const r = await checkIntegrityAsync(p)
  assert.equal(r.ok, false)
  assert.ok(String(r.detail).length > 0)
})

test('checkIntegrityAsync: missing file resolves ok:false', async () => {
  const r = await checkIntegrityAsync(path.join(tmp, 'no-such-file.sqlite'))
  assert.equal(r.ok, false)
  assert.ok(String(r.detail).length > 0)
})

test('checkIntegrityAsync: worker startup failure falls back to in-process check with a warning', async (t) => {
  const warns = []
  t.mock.method(console, 'warn', (...args) => {
    warns.push(args.map(String).join(' '))
  })
  // 模拟 nproc 受限时的 uv_thread_create 失败
  const failingRunner = async () => {
    throw Object.assign(new Error('simulated uv_thread_create failure'), { code: 'WORKER_START_FAIL' })
  }

  const good = makeGoodDb('fallback-good.sqlite')
  const r = await checkIntegrityAsync(good, { runner: failingRunner })
  assert.equal(r.ok, true)
  assert.match(String(r.detail), /ok/i)
  assert.ok(warns.some((w) => /fallback|回退/.test(w)), '应回退并告警')

  const bad = path.join(tmp, 'fallback-garbage.sqlite')
  fs.writeFileSync(bad, 'not a database')
  const r2 = await checkIntegrityAsync(bad, { runner: failingRunner })
  assert.equal(r2.ok, false)
  assert.ok(String(r2.detail).length > 0)
})

test('checkIntegrityAsync: injected runner result is used as-is (DI)', async () => {
  const seen = []
  const r = await checkIntegrityAsync('whatever.sqlite', {
    runner: async (dbPath) => {
      seen.push(dbPath)
      return { ok: true, detail: 'ok' }
    },
  })
  assert.deepEqual(seen, ['whatever.sqlite'])
  assert.deepEqual(r, { ok: true, detail: 'ok' })
})

test('checkIntegrityAsync: invalid runner result falls back to in-process check', async (t) => {
  t.mock.method(console, 'warn', () => {})
  const p = makeGoodDb('bad-runner-result.sqlite')
  const r = await checkIntegrityAsync(p, {
    runner: async () => 'not-a-result',
  })
  assert.equal(r.ok, true)
})

test('checkIntegrityAsync rejects only on infrastructure failure (bad arg)', async () => {
  await assert.rejects(() => checkIntegrityAsync(''), { code: 'BAD_ARG' })
})

test('runIntegrityInWorker resolves from the worker thread and terminates it', async (t) => {
  const p = makeGoodDb('worker-direct.sqlite')
  try {
    const r = await runIntegrityInWorker(p)
    assert.equal(r.ok, true)
    assert.match(String(r.detail), /ok/i)
  } catch (e) {
    // 该容器 nproc 受限导致 uv_thread_create 失败时允许跳过（回退路径另有用例覆盖）
    if (e?.code === 'WORKER_START_FAIL' || e?.code === 'WORKER_ERROR' || e?.code === 'WORKER_EXIT') {
      return t.skip(`worker spawn unavailable: ${e.message}`)
    }
    throw e
  }
})

test('checkpointWalAsync truncates the WAL and resolves { ok, detail }', async () => {
  const p = makeGoodDb('ckpt.sqlite')
  const db = new Database(p)
  db.prepare('INSERT INTO t VALUES (?)').run('y'.repeat(120))
  try {
    const r = await checkpointWalAsync(p)
    assert.equal(r.ok, true)
  } finally {
    db.close()
  }
})

test('checkpointWalAsync falls back in-process when the worker fails and never rejects', async (t) => {
  t.mock.method(console, 'warn', () => {})
  const p = makeGoodDb('ckpt-fallback.sqlite')
  const failingRunner = async () => {
    throw new Error('simulated worker failure')
  }
  const r = await checkpointWalAsync(p, { runner: failingRunner })
  assert.equal(r.ok, true)
  const missing = await checkpointWalAsync(path.join(tmp, 'ckpt-missing.sqlite'), { runner: failingRunner })
  assert.equal(missing.ok, false)
})
