import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'

export function resolveNodeBin(appRoot, platform = process.platform) {
  const bundled = path.join(appRoot, 'runtime', platform === 'win32' ? 'node.exe' : 'node')
  if (fs.existsSync(bundled)) return bundled
  return platform === 'win32' ? 'node.exe' : 'node'
}

export function resolveServerEntry(appRoot) {
  const packed = path.join(appRoot, 'server', 'dist', 'index.cjs')
  if (fs.existsSync(packed)) return packed
  const src = path.join(appRoot, 'server', 'src', 'index.js')
  if (fs.existsSync(src)) return src
  throw new Error('找不到服务入口（server/dist/index.cjs 或 server/src/index.js）')
}

export function waitHealth(port, timeoutMs = 60_000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        res.resume()
        if (res.statusCode === 200) return resolve(true)
        retry()
      })
      req.on('error', retry)
      req.setTimeout(2000, () => {
        req.destroy()
        retry()
      })
    }
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`等待服务启动超时 :${port}`))
        return
      }
      setTimeout(tick, 400)
    }
    tick()
  })
}

export async function isServerUp(port) {
  try {
    await waitHealth(port, 1500)
    return true
  } catch {
    return false
  }
}

export function spawnAppServer({ appRoot, port, nodeBin, entry, logStream }) {
  const env = {
    ...process.env,
    ACW_PORT: String(port),
    ACW_AUTO_EXIT: '0',
  }
  const stdio = logStream ? ['ignore', logStream, logStream] : 'ignore'
  return spawn(nodeBin, [entry], {
    cwd: appRoot,
    env,
    stdio,
    windowsHide: true,
  })
}

export function stopChild(child, platform = process.platform) {
  if (!child || child.killed || child.exitCode != null) return
  const pid = child.pid
  try {
    if (platform === 'win32' && pid) {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      })
      return
    }
    child.kill('SIGTERM')
  } catch {
    try {
      child.kill()
    } catch {
      /* ignore */
    }
  }
}
