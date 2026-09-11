/**
 * Windows 桌面包启动器：用包内 node 拉起 electron.exe。
 * 不用 cmd 的 start（引号、%~dp0、chcp 65001 都容易把进程拉起来又立刻没窗口）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export function resolveAppRoot(fromUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(fromUrl)))
}

export function electronExe(appRoot) {
  return path.join(appRoot, 'desktop', 'electron.exe')
}

function appendLog(appRoot, line) {
  const dir = path.join(appRoot, 'data')
  fs.mkdirSync(dir, { recursive: true })
  fs.appendFileSync(path.join(dir, 'desktop-launch.log'), `[${new Date().toISOString()}] ${line}\n`)
}

export function spawnElectron(appRoot, spawnImpl = spawn) {
  const exe = electronExe(appRoot)
  const logPath = path.join(appRoot, 'data', 'electron.log')
  fs.mkdirSync(path.dirname(logPath), { recursive: true })
  const logFd = fs.openSync(logPath, 'a')
  const child = spawnImpl(exe, [appRoot], {
    cwd: appRoot,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    windowsHide: false,
    env: {
      ...process.env,
      ELECTRON_ENABLE_LOGGING: '1',
    },
  })
  child.once('error', (err) => {
    appendLog(appRoot, `spawn error ${err?.message || err}`)
  })
  return child
}

async function waitAlive(child, ms = 2500) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(true), ms)
    child.once('exit', (code, signal) => {
      clearTimeout(timer)
      resolve({ code, signal })
    })
  })
}

async function main() {
  const appRoot = resolveAppRoot()
  const exe = electronExe(appRoot)
  if (!fs.existsSync(exe)) {
    appendLog(appRoot, `missing ${exe}`)
    console.error('desktop\\electron.exe not found')
    process.exit(1)
  }
  appendLog(appRoot, `spawn ${exe} app=${appRoot}`)
  const child = spawnElectron(appRoot)
  const alive = await waitAlive(child)
  if (alive !== true) {
    appendLog(appRoot, `electron exited early code=${alive.code} signal=${alive.signal}`)
    console.error('Electron exited immediately. See data\\electron.log')
    process.exit(1)
  }
  appendLog(appRoot, `electron pid=${child.pid}`)
  child.unref()
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirect) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
