/**
 * 一键启动（压缩包 / 本机推荐入口）
 * - 必要时 npm install
 * - 启动 API（默认不随浏览器退出；需要时设 ACW_AUTO_EXIT=1）
 * - 自动打开浏览器
 *
 * 用法：node start.mjs
 * 或双击 start.bat / ./start.sh
 */
import { spawn, exec, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = __dirname
const PORT = Number(process.env.ACW_PORT || 3780)
/** 默认关闭：切换标签/切应用易误杀；仅显式 ACW_AUTO_EXIT=1 才开 */
const AUTO_EXIT =
  process.env.ACW_AUTO_EXIT === '1' ||
  process.env.ACW_AUTO_EXIT === 'true' ||
  process.env.ACW_AUTO_EXIT === 'yes'

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
    { cwd: ROOT, env, stdio: 'inherit', windowsHide: false },
  )

  const killChild = () => {
    if (!child || child.killed || child.exitCode != null) return
    const pid = child.pid
    try {
      if (process.platform === 'win32' && pid) {
        // 关闭 bat/CMD 窗口时，杀掉整棵进程树，避免服务残留
        spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
        })
      } else {
        try {
          child.kill('SIGTERM')
        } catch {
          /* ignore */
        }
        try {
          child.kill('SIGKILL')
        } catch {
          /* ignore */
        }
      }
    } catch {
      try {
        child.kill()
      } catch {
        /* ignore */
      }
    }
  }

  const shutdown = () => {
    killChild()
  }
  process.on('SIGINT', () => {
    shutdown()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    shutdown()
    process.exit(0)
  })
  process.on('SIGHUP', () => {
    shutdown()
    process.exit(0)
  })
  process.on('exit', killChild)

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
    log('提示：已开启 ACW_AUTO_EXIT，关闭浏览器后后台可能退出')
  } else {
    log('提示：关闭本窗口（或 Ctrl+C）即可结束服务；关浏览器不会停服务')
  }
  openBrowser(url)
}

main().catch((e) => {
  console.error('[acw-start] FAIL', e.message || e)
  process.exit(1)
})
