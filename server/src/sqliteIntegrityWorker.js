/**
 * SRV-01：SQLite integrity_check / wal_checkpoint 下放到 node:worker_threads。
 *
 * 目标：备份/恢复热路径上的 PRAGMA 不再阻塞事件循环。integrity_check 以
 * `readonly: true, fileMustExist: true` 打开目标文件（只读探测，绝不写入）；
 * wal_checkpoint(TRUNCATE) 是写操作，无法在只读连接上执行，使用
 * `fileMustExist: true` 的普通连接在 worker 内执行。
 *
 * 本文件自包含（不 import db.js / 应用其它模块），既是库也是 worker 入口：
 * 主线程 import 拿到 checkIntegrityAsync 等导出；`new Worker(本文件)` 时
 * 走 isMainThread 分支，回传 { ok, detail } 后退出。
 *
 * 契约：
 * - 文件损坏 / 缺失 / 非 sqlite → 永不抛出，resolve { ok: false, detail }
 * - worker 启动失败（如 nproc 受限导致 uv_thread_create 失败）→ 告警并回退
 *   进程内同步 pragma，恢复流程不得因 worker 不可用而硬失败
 * - 仅基础设施级失败（SQLite 驱动整体不可加载、入参非法）才 reject
 */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const WORKER_FILE = fileURLToPath(import.meta.url)

/**
 * 加载 sqlite 驱动的 probe 打开函数。优先 better-sqlite3；ABI 不匹配的运行包
 * 回退 node:sqlite（与 db.js 的 openDatabase 策略一致）。两者都不可用属于
 * 基础设施故障，抛错（由调用方按 reject / 回退处理）。
 * @returns {(dbPath: string) => { prepare: Function, close: Function }}
 */
function loadProbeOpen({ readonly }) {
  try {
    const Database = require('better-sqlite3')
    return (dbPath) => new Database(dbPath, { readonly, fileMustExist: true })
  } catch {
    /* fall through to node:sqlite */
  }
  try {
    const { DatabaseSync } = require('node:sqlite')
    return (dbPath) => new DatabaseSync(dbPath, { readOnly: readonly })
  } catch {
    /* no driver at all */
  }
  throw Object.assign(new Error('SQLite 驱动不可用（better-sqlite3 / node:sqlite）'), {
    code: 'NO_SQLITE_DRIVER',
  })
}

function detailFromRows(rows) {
  return Array.isArray(rows)
    ? rows.map((r) => (r && r.integrity_check != null ? r.integrity_check : String(r))).join('; ')
    : String(rows)
}

/**
 * 进程内同步 PRAGMA integrity_check（worker 内与回退路径共用）。
 * 文件级问题（损坏 / 缺失 / 非 sqlite）返回 { ok: false, detail }，不抛出。
 * @param {string} dbPath
 * @returns {{ ok: boolean, detail: string }}
 */
export function checkIntegrityInProcess(dbPath) {
  const open = loadProbeOpen({ readonly: true })
  let probe
  try {
    probe = open(dbPath)
    const rows = probe.prepare('PRAGMA integrity_check').all()
    const detail = detailFromRows(rows)
    const ok = detail === 'ok' || /^ok$/i.test(String(detail).trim())
    return { ok, detail }
  } catch (e) {
    // file is not a database / database disk image is malformed 等一律按完整性失败处理
    return { ok: false, detail: e?.message || String(e) }
  } finally {
    try {
      probe?.close?.()
    } catch {
      /* ignore */
    }
  }
}

/**
 * 进程内同步 wal_checkpoint(TRUNCATE)。失败返回 { ok: false, detail }，不抛出。
 * @param {string} dbPath
 * @returns {{ ok: boolean, detail: string }}
 */
export function checkpointWalInProcess(dbPath) {
  const open = loadProbeOpen({ readonly: false })
  let probe
  try {
    probe = open(dbPath)
    probe.prepare('PRAGMA wal_checkpoint(TRUNCATE)').all()
    return { ok: true, detail: 'ok' }
  } catch (e) {
    return { ok: false, detail: e?.message || String(e) }
  } finally {
    try {
      probe?.close?.()
    } catch {
      /* ignore */
    }
  }
}

// ---------------------------------------------------------------------------
// worker 入口：isMainThread 为 false 时执行一次检查并回传结果后退出
// ---------------------------------------------------------------------------
if (!isMainThread) {
  const { dbPath, mode } = workerData || {}
  // 这里故意不 try/catch：驱动不可用等基础设施故障抛到 worker 'error' 事件，
  // 让主线程按基础设施故障走 reject / 回退，而不是伪装成 ok:false
  const result = mode === 'checkpoint' ? checkpointWalInProcess(dbPath) : checkIntegrityInProcess(dbPath)
  parentPort.postMessage(result)
}

/**
 * 在 worker 线程里跑一次检查。resolve { ok, detail } 后 terminate worker。
 * worker 启动 / 运行失败时 reject（基础设施故障），由调用方决定是否回退。
 * @param {string} dbPath
 * @param {'integrity' | 'checkpoint'} mode
 * @returns {Promise<{ ok: boolean, detail: string }>}
 */
function runInWorker(dbPath, mode) {
  return new Promise((resolve, reject) => {
    let settled = false
    let worker
    try {
      worker = new Worker(WORKER_FILE, { workerData: { dbPath, mode } })
    } catch (e) {
      reject(
        Object.assign(new Error(`integrity worker 启动失败：${e?.message || e}`), {
          code: 'WORKER_START_FAIL',
          detail: e?.message || String(e),
        }),
      )
      return
    }
    const settle = (fn, value) => {
      if (settled) return
      settled = true
      fn(value)
    }
    worker.once('message', (msg) => {
      settle(resolve, msg)
      void worker.terminate()
    })
    worker.once('error', (err) => {
      settle(
        reject,
        Object.assign(new Error(`integrity worker 异常：${err?.message || err}`), {
          code: 'WORKER_ERROR',
          detail: err?.message || String(err),
        }),
      )
      void worker.terminate()
    })
    worker.once('exit', (code) => {
      settle(
        reject,
        Object.assign(new Error(`integrity worker 提前退出（code=${code}）`), {
          code: 'WORKER_EXIT',
          detail: `exit ${code}`,
        }),
      )
    })
  })
}

/** worker 结果形状校验：非法结果按基础设施故障处理（触发回退） */
function normalizeResult(r) {
  if (!r || typeof r !== 'object' || typeof r.ok !== 'boolean') {
    throw Object.assign(new Error('integrity worker 返回了非法结果'), {
      code: 'WORKER_BAD_RESULT',
      detail: String(r),
    })
  }
  return { ok: r.ok, detail: r.detail != null ? String(r.detail) : '' }
}

/**
 * 先走 runner（默认 worker），失败时告警并回退进程内同步 pragma。
 * @param {string} dbPath
 * @param {'integrity' | 'checkpoint'} mode
 * @param {(dbPath: string) => Promise<{ ok: boolean, detail: string }>} runner
 */
async function withInProcessFallback(dbPath, mode, runner) {
  try {
    return normalizeResult(await runner(dbPath))
  } catch (e) {
    console.warn(
      `[acw] ${mode === 'checkpoint' ? 'wal_checkpoint' : 'integrity_check'} worker 不可用，回退进程内同步检查（fallback）：`,
      e?.message || e,
    )
    return normalizeResult(
      mode === 'checkpoint' ? checkpointWalInProcess(dbPath) : checkIntegrityInProcess(dbPath),
    )
  }
}

/** 默认 runner：在 worker 线程里跑 PRAGMA integrity_check */
export function runIntegrityInWorker(dbPath) {
  return runInWorker(dbPath, 'integrity')
}

/** 默认 runner：在 worker 线程里跑 wal_checkpoint(TRUNCATE) */
export function checkpointWalInWorker(dbPath) {
  return runInWorker(dbPath, 'checkpoint')
}

/**
 * SRV-01：worker 线程内对独立 sqlite 文件跑 PRAGMA integrity_check。
 * resolve { ok, detail }，结束 worker；损坏 / 缺失 / 非 sqlite 永不抛出
 * （ok:false + detail）；仅基础设施故障（驱动不可用、入参非法）reject。
 * @param {string} dbPath
 * @param {{ runner?: (dbPath: string) => Promise<{ ok: boolean, detail: string }> }} [deps]
 *        DI：注入自定义 runner（测试可模拟 worker 启动失败）
 * @returns {Promise<{ ok: boolean, detail: string }>}
 */
export async function checkIntegrityAsync(dbPath, deps = {}) {
  if (typeof dbPath !== 'string' || !dbPath) {
    throw Object.assign(new Error('checkIntegrityAsync 需要非空 dbPath 字符串'), { code: 'BAD_ARG' })
  }
  const runner = deps.runner || runIntegrityInWorker
  return withInProcessFallback(dbPath, 'integrity', runner)
}

/**
 * SRV-01：worker 线程内跑 wal_checkpoint(TRUNCATE)。尽力而为：任何失败都
 * resolve { ok: false, detail }（调用方告警即可），不 reject。
 * @param {string} dbPath
 * @param {{ runner?: (dbPath: string) => Promise<{ ok: boolean, detail: string }> }} [deps]
 * @returns {Promise<{ ok: boolean, detail: string }>}
 */
export async function checkpointWalAsync(dbPath, deps = {}) {
  try {
    const runner = deps.runner || checkpointWalInWorker
    return await withInProcessFallback(dbPath, 'checkpoint', runner)
  } catch (e) {
    console.warn('[acw] wal_checkpoint', e?.message || e)
    return { ok: false, detail: e?.message || String(e) }
  }
}
