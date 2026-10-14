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

/** App version from server/config/about.json, falling back to root package.json. */
export function readAppVersion(appRoot) {
  try {
    const about = JSON.parse(fs.readFileSync(path.join(appRoot, 'server', 'config', 'about.json'), 'utf8'))
    if (about && about.version) return String(about.version)
  } catch {
    /* ignore */
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'))
    if (pkg && pkg.version) return String(pkg.version)
  } catch {
    /* ignore */
  }
  return ''
}

/** GET /api/health and parse JSON. Rejects on non-200 / parse error / timeout. */
export function fetchHealth(port, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (d) => {
        body += d
      })
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`health status ${res.statusCode}`))
          return
        }
        try {
          resolve(JSON.parse(body))
        } catch (e) {
          reject(e)
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('health timeout'))
    })
  })
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

export function openAppendFd(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  return fs.openSync(filePath, 'a')
}

/** spawn stdio 必须是已打开的 fd。WriteStream 在 'open' 之前 fd 为 null，Windows 上会直接抛 stdio invalid。 */
export function stdioForChildLog(logFd) {
  if (logFd == null) return 'ignore'
  if (typeof logFd === 'object') {
    const fd = logFd.fd
    if (typeof fd !== 'number' || fd < 0) {
      throw new Error('日志文件尚未打开，不能作为子进程 stdio')
    }
    return ['ignore', fd, fd]
  }
  if (typeof logFd !== 'number' || logFd < 0) {
    throw new Error('logFd 必须是已打开的文件描述符')
  }
  return ['ignore', logFd, logFd]
}

export function spawnAppServer({ appRoot, port, nodeBin, entry, logFd, instanceId }) {
  const env = {
    ...process.env,
    ACW_PORT: String(port),
    ACW_AUTO_EXIT: '0',
  }
  if (instanceId) env.ACW_INSTANCE_ID = String(instanceId)
  return spawn(nodeBin, [entry], {
    cwd: appRoot,
    env,
    stdio: stdioForChildLog(logFd),
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
