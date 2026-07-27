/**
 * 一键启动（压缩包 / 本机推荐入口）
 * - 必要时 npm install
 * - 启动 API（默认不随浏览器退出；需要时设 ACW_AUTO_EXIT=1）
 * - 自动打开浏览器；或 ACW_HEADLESS_BROWSER=1 用 Playwright 无头加载页面（关脚本即关浏览器）
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
/** Playwright 无头打开工作台（无界面）；退出 start 进程时自动 browser.close() */
const HEADLESS_BROWSER =
  process.env.ACW_HEADLESS_BROWSER === '1' ||
  process.env.ACW_HEADLESS_BROWSER === 'true' ||
  process.env.ACW_HEADLESS_BROWSER === 'yes'

/** @type {import('playwright').Browser | null} */
let headlessBrowser = null
let shuttingDown = false

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

async function closeHeadlessBrowser() {
  if (!headlessBrowser) return
  try {
    await headlessBrowser.close()
  } catch {
    /* ignore */
  }
  headlessBrowser = null
}

async function openHeadlessBrowser(url) {
  let chromium
  try {
    ;({ chromium } = await import('playwright'))
  } catch {
    throw new Error(
      '无头模式需要 dev 依赖 playwright：在项目根执行 npm install && npx playwright install chromium',
    )
  }
  headlessBrowser = await chromium.launch({ headless: true })
  const page = await headlessBrowser.newPage()
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  log('无头浏览器已加载', url)
  log('提示：无界面；按 Ctrl+C 或关闭本窗口将自动关闭无头浏览器并停止服务')
}

async function ensureInstall() {
  const sqliteOk = exists(path.join(ROOT, 'node_modules', 'better-sqlite3'))
  const playwrightOk = exists(path.join(ROOT, 'node_modules', 'playwright'))
  if (sqliteOk && (!HEADLESS_BROWSER || playwrightOk)) {
    log('依赖已就绪')
    return
  }
  log('首次启动，正在 npm install …')
  await run('npm', HEADLESS_BROWSER ? ['install'] : ['install', '--omit=dev'])
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

  const shutdown = async (code = 0) => {
    if (shuttingDown) return
    shuttingDown = true
    await closeHeadlessBrowser()
    killChild()
    process.exit(code)
  }
  process.on('SIGINT', () => {
    shutdown(0)
  })
  process.on('SIGTERM', () => {
    shutdown(0)
  })
  process.on('SIGHUP', () => {
    shutdown(0)
  })
  process.on('exit', () => {
    killChild()
  })

  child.on('exit', (code) => {
    log('服务已退出', code)
    shutdown(code || 0)
  })

  try {
    await waitHealth()
  } catch (e) {
    log(e.message)
    shutdown()
    process.exit(1)
  }

  const url = `http://127.0.0.1:${PORT}/`
  if (HEADLESS_BROWSER) {
    log('无头浏览器模式', url)
    try {
      await openHeadlessBrowser(url)
    } catch (e) {
      log(e.message || e)
      await shutdown(1)
      return
    }
  } else {
    log('打开浏览器', url)
    if (AUTO_EXIT) {
      log('提示：已开启 ACW_AUTO_EXIT，关闭浏览器后后台可能退出')
    } else {
      log('提示：关闭本窗口（或 Ctrl+C）即可结束服务；关浏览器不会停服务')
    }
    openBrowser(url)
  }
}

main().catch((e) => {
  console.error('[acw-start] FAIL', e.message || e)
  process.exit(1)
})
