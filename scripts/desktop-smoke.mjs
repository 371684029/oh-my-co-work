#!/usr/bin/env node
/**
 * linux-x64 桌面包真机冒烟：解压 → xvfb 下启动 Electron → 等 /api/health 与「workbench loaded」。
 * 只看 verify-pack 的文件清单抓不到「文件都在但主进程 import 失败 / 原生模块 ABI 不对」这类问题，
 * 必须真把窗口拉起来。win32/darwin 交叉打包产物没法在 ubuntu runner 上执行，共用同一套打包逻辑，
 * 由 linux 这份代为把关。
 *
 * 用法：node scripts/desktop-smoke.mjs --zip release/oh-my-co-work-v5-linux-x64-desktop.zip [--port 3799]
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import { fetchHealth } from '../electron/lib/server.mjs'

function argValue(name, fallback = '') {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : fallback
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function readIf(p) {
  try {
    return fs.readFileSync(p, 'utf8')
  } catch {
    return ''
  }
}

async function main() {
  const zip = path.resolve(argValue('--zip'))
  const port = Number(argValue('--port', '3799'))
  const timeoutMs = Number(argValue('--timeout-ms', '90000'))
  if (!fs.existsSync(zip)) throw new Error(`找不到 zip: ${zip}`)

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-desktop-smoke-'))
  execFileSync('unzip', ['-q', zip, '-d', work])
  const appRoot = path.join(work, path.basename(zip, '.zip'))
  const exe = path.join(appRoot, 'desktop', 'oh-my-co-work')
  if (!fs.existsSync(exe)) throw new Error(`桌面包缺少 ${exe}`)
  const home = path.join(work, 'home')
  fs.mkdirSync(home, { recursive: true })

  // CI 容器里没有 SUID chrome-sandbox / user namespace，必须 --no-sandbox
  const child = spawn('xvfb-run', ['-a', exe, '--no-sandbox', appRoot], {
    cwd: appRoot,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ACW_PORT: String(port), HOME: home, ELECTRON_ENABLE_LOGGING: '1' },
  })
  let stdout = ''
  child.stdout.on('data', (d) => (stdout += d))
  child.stderr.on('data', (d) => (stdout += d))
  let exited = null
  child.once('exit', (code, signal) => (exited = { code, signal }))

  const electronLog = path.join(appRoot, 'data', 'electron.log')
  const started = Date.now()
  let health = null
  try {
    while (Date.now() - started < timeoutMs) {
      if (exited) throw new Error(`Electron 提前退出 code=${exited.code} signal=${exited.signal}`)
      health = health || (await fetchHealth(port, 1500).catch(() => null))
      if (health && readIf(electronLog).includes('workbench loaded')) break
      await sleep(500)
    }
    if (!health) throw new Error(`等待 /api/health 超时（${timeoutMs}ms）`)
    if (!readIf(electronLog).includes('workbench loaded')) {
      throw new Error('服务已起，但 Electron 未加载工作台（electron.log 无 workbench loaded）')
    }
    if (!health.ok) throw new Error(`health ok=false: ${JSON.stringify(health)}`)
    if (health.sqliteDriver !== 'better-sqlite3') {
      throw new Error(`桌面包应使用 better-sqlite3，实际 ${health.sqliteDriver}（原生模块 ABI 与 runtime/node 不符？）`)
    }
    console.log(`[desktop-smoke] ok v${health.version} sqliteDriver=${health.sqliteDriver}`)
  } catch (e) {
    console.error('[desktop-smoke] FAIL', e?.message || e)
    console.error('--- data/electron.log ---\n' + readIf(electronLog))
    console.error('--- data/desktop-server.log ---\n' + readIf(path.join(appRoot, 'data', 'desktop-server.log')))
    console.error('--- electron stdout/stderr (tail) ---\n' + stdout.split('\n').slice(-40).join('\n'))
    process.exitCode = 1
  } finally {
    try {
      process.kill(-child.pid, 'SIGKILL')
    } catch {
      /* already gone */
    }
    try {
      execFileSync('pkill', ['-9', '-f', appRoot])
    } catch {
      /* nothing left */
    }
  }
}

main().catch((e) => {
  console.error('[desktop-smoke] FAIL', e?.message || e)
  process.exit(1)
})
