/**
 * 一键启动（压缩包 / 本机推荐入口）
 * - 必要时 npm install
 * - 启动 API（默认 ACW_AUTO_EXIT=1：关浏览器后退出）
 * - 自动打开浏览器
 *
 * 用法：node start.mjs
 * 或双击 start.bat / ./start.sh
 */
import { spawn, exec } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = __dirname
const PORT = Number(process.env.ACW_PORT || 3780)
const AUTO_EXIT = process.env.ACW_AUTO_EXIT !== '0' && process.env.ACW_AUTO_EXIT !== 'false'

function log(...a) {
  console.log('[acw-start]', ...a)
}

function exists(p) {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...opts,
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`))
    })
  })
}

function waitHealth(timeoutMs = 60_000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(`http://127.0.0.1:${PORT}/api/health`, (res) => {
        res.resume()
        if (res.statusCode === 200) return resolve()
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
        reject(new Error('等待服务启动超时'))
        return
      }
      setTimeout(tick, 400)
    }
    tick()
  })
}

function openBrowser(url) {
  const plat = process.platform
  if (plat === 'win32') {
    exec(`start "" "${url}"`)
  } else if (plat === 'darwin') {
    exec(`open "${url}"`)
  } else {
    exec(`xdg-open "${url}"`)
  }
}

async function ensureInstall() {
  if (exists(path.join(ROOT, 'node_modules', 'better-sqlite3'))) {
    log('依赖已就绪')
    return
  }
  log('首次启动，正在 npm install …')
  await run('npm', ['install', '--omit=dev'])
}

async function main() {
  process.chdir(ROOT)
  log('工作目录', ROOT)
  log('Node', process.version)
  if (!exists(path.join(ROOT, 'web', 'dist', 'index.html'))) {
    log('未找到 web/dist，尝试构建前端…')
    await run('npm', ['run', 'build', '-w', 'web'])
  }
  await ensureInstall()

  const env = {
    ...process.env,
    ACW_PORT: String(PORT),
    ACW_AUTO_EXIT: AUTO_EXIT ? '1' : '0',
  }
  log(`启动服务 :${PORT}  auto-exit=${AUTO_EXIT ? 'on' : 'off'}`)
  const child = spawn(
    process.execPath,
    [path.join(ROOT, 'server', 'src', 'index.js')],
    { cwd: ROOT, env, stdio: 'inherit' },
  )

  const shutdown = () => {
    try {
      child.kill('SIGTERM')
    } catch {
      /* ignore */
    }
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  child.on('exit', (code) => {
    log('服务已退出', code)
    process.exit(code || 0)
  })

  try {
    await waitHealth()
  } catch (e) {
    log(e.message)
    shutdown()
    process.exit(1)
  }

  const url = `http://127.0.0.1:${PORT}/`
  log('打开浏览器', url)
  if (AUTO_EXIT) {
    log('提示：关闭浏览器窗口后，后台将在数秒内自动退出')
  }
  openBrowser(url)
}

main().catch((e) => {
  console.error('[acw-start] FAIL', e.message || e)
  process.exit(1)
})
