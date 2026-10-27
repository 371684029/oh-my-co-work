/**
 * 桌面包启动器（win32 / linux / darwin）：用包内 node 拉起 Electron。
 * win32 不用 cmd 的 start（引号、%~dp0、chcp 65001 都容易把进程拉起来又立刻没窗口）。
 * darwin 保持 Electron.app 包结构，直接调 Electron.app/Contents/MacOS/Electron；
 * macOS codesign/公证不在本范围（需要 Apple 开发者证书，包为未签名便携版）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export function resolveAppRoot(fromUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(fromUrl)))
}

/**
 * 按当前平台解析桌面包内 Electron 可执行文件（platform 参数仅供测试注入）：
 * - win32：desktop/oh-my-co-work.exe（品牌图标）→ 兜底 desktop/electron.exe（历史布局）
 * - linux：desktop/oh-my-co-work（品牌名）→ 兜底 desktop/electron
 * - darwin：desktop/oh-my-co-work.app/Contents/MacOS/Electron → 兜底 Electron.app/.../Electron
 */
export function electronExe(appRoot, platform = process.platform) {
  if (platform === 'darwin') {
    const branded = path.join(
      appRoot,
      'desktop',
      'oh-my-co-work.app',
      'Contents',
      'MacOS',
      'Electron',
    )
    if (fs.existsSync(branded)) return branded
    return path.join(appRoot, 'desktop', 'Electron.app', 'Contents', 'MacOS', 'Electron')
  }
  const exeName = platform === 'win32' ? 'oh-my-co-work.exe' : 'oh-my-co-work'
  const fallbackName = platform === 'win32' ? 'electron.exe' : 'electron'
  const branded = path.join(appRoot, 'desktop', exeName)
  if (fs.existsSync(branded)) return branded
  return path.join(appRoot, 'desktop', fallbackName)
}

function appendLog(appRoot, line) {
  const dir = path.join(appRoot, 'data')
  fs.mkdirSync(dir, { recursive: true })
  fs.appendFileSync(path.join(dir, 'desktop-launch.log'), `[${new Date().toISOString()}] ${line}\n`)
}

function readProcFlag(p) {
  try {
    return fs.readFileSync(p, 'utf8').trim()
  } catch {
    return null
  }
}

function probeLinuxSandbox(appRoot) {
  let suidHelper = false
  try {
    const st = fs.statSync(path.join(appRoot, 'desktop', 'chrome-sandbox'))
    suidHelper = st.uid === 0 && (st.mode & 0o4000) !== 0
  } catch {
    /* 没有 helper */
  }
  const usernsBlocked =
    readProcFlag('/proc/sys/kernel/apparmor_restrict_unprivileged_userns') === '1' ||
    readProcFlag('/proc/sys/kernel/unprivileged_userns_clone') === '0' ||
    readProcFlag('/proc/sys/user/max_user_namespaces') === '0'
  return { suidHelper, usernsBlocked }
}

/**
 * Linux 上 Chromium 沙箱要么靠 SUID root 的 chrome-sandbox，要么靠非特权 user namespace。
 * zip 解压后 chrome-sandbox 必然丢了 SUID；Ubuntu 23.10+ 默认又用 AppArmor 禁了 userns，
 * 两条都不通时 Electron 启动即崩（"The SUID sandbox helper binary was found, but is not
 * configured correctly"），只能 --no-sandbox。渲染进程只加载本机 127.0.0.1 工作台。
 * ACW_ELECTRON_NO_SANDBOX=1 可强制关闭。
 */
export function electronSandboxArgs(
  appRoot,
  { platform = process.platform, env = process.env, probe = probeLinuxSandbox } = {},
) {
  if (platform !== 'linux') return []
  if (['1', 'true', 'yes'].includes(String(env.ACW_ELECTRON_NO_SANDBOX || '').toLowerCase())) {
    return ['--no-sandbox']
  }
  const { suidHelper, usernsBlocked } = probe(appRoot)
  return !suidHelper && usernsBlocked ? ['--no-sandbox'] : []
}

export function spawnElectron(
  appRoot,
  spawnImpl = spawn,
  { extraArgs = electronSandboxArgs(appRoot) } = {},
) {
  const exe = electronExe(appRoot)
  const logPath = path.join(appRoot, 'data', 'electron.log')
  fs.mkdirSync(path.dirname(logPath), { recursive: true })
  const logFd = fs.openSync(logPath, 'a')
  if (extraArgs.length) appendLog(appRoot, `electron args ${extraArgs.join(' ')}`)
  const child = spawnImpl(exe, [...extraArgs, appRoot], {
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
    console.error('desktop Electron binary not found (oh-my-co-work / electron / Electron.app)')
    process.exit(1)
  }
  appendLog(appRoot, `spawn ${exe} app=${appRoot}`)
  const child = spawnElectron(appRoot)
  const alive = await waitAlive(child)
  if (alive !== true) {
    appendLog(appRoot, `electron exited early code=${alive.code} signal=${alive.signal}`)
    console.error('Electron exited immediately. See data/electron.log')
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
