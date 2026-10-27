#!/usr/bin/env node
/**
 * 打【运行包】压缩包（不是源码树）：
 * - 前端 vite build → web/dist
 * - 后端 esbuild 打成 server/dist/index.js（不含 server/src）
 * - 在包内预装 better-sqlite3 等运行依赖（用户不必再 npm install）
 *
 * 产物（提交进 git）：
 *   packages/oh-my-co-work-v{MAJOR}-{platform}-{arch}.zip
 *   · 同大版本 + 同平台：覆盖替换（小版本即最新）
 *   · 仓库只保留当前大版本：打新大版本时删除旧大版本全部 zip
 *   · 多平台：linux / win32 / darwin 各留一份（当前大版本内）
 *
 * 用法：npm run pack
 */
import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { windowsStartBat } from './windowsStartBat.mjs'

/** 桌面包内嵌运行时版本：唯一来源是根 package.json 的 acwPack（工作流缓存 key 也读它） */
const { nodeVersion: PACK_NODE_VERSION, electronVersion: PACK_ELECTRON_VERSION } = JSON.parse(
  fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).acwPack
/** Node 主版本 → NODE_MODULE_VERSION；桌面包 better-sqlite3 必须按内嵌 runtime 的 ABI 取，而不是打包机 */
const NODE_ABI_BY_MAJOR = { 18: '108', 20: '115', 22: '127', 24: '137' }
function runtimeNodeAbi(nodeVersion = PACK_NODE_VERSION) {
  const abi = NODE_ABI_BY_MAJOR[Number(String(nodeVersion).split('.')[0])]
  if (!abi) throw new Error(`未知 Node ${nodeVersion} 的 ABI，请补充 NODE_ABI_BY_MAJOR`)
  return abi
}
/** GitHub 仓库文件硬限制 100MB；含 Electron 的桌面包只放 release/ 与 GitHub Release */
const GIT_ZIP_MAX_BYTES = 95 * 1024 * 1024

function wantDesktopPack() {
  if (process.argv.includes('--desktop')) return true
  const v = String(process.env.ACW_PACK_DESKTOP || '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_ROOT = path.join(ROOT, 'release')
const PACKAGES_DIR = path.join(ROOT, 'packages')
const require = createRequire(import.meta.url)

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd || ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...(opts.env || {}) },
  })
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed: ${r.status}`)
}

function gitCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT })
      .toString()
      .trim()
  } catch {
    return 'nogit'
  }
}

function majorOf(ver) {
  const m = String(ver || '0').match(/^(\d+)/)
  return m ? Number(m[1]) : 0
}

function platformTag() {
  const p = process.platform // win32 | linux | darwin
  const a = process.arch // x64 | arm64 | …
  return `${p}-${a}`
}

function packTarget() {
  const tag = String(
    process.env.ACW_PACK_TARGET || (process.argv.includes('--desktop') ? 'win32-x64' : platformTag()),
  ).trim()
  const match = tag.match(/^(win32|linux|darwin)-(x64|arm64)$/)
  if (!match) {
    throw new Error(
      `ACW_PACK_TARGET=${tag} 无效，应为 win32|linux|darwin 与 x64|arm64 的组合`,
    )
  }
  return {
    tag,
    platform: match[1],
    arch: match[2],
    cross: tag !== platformTag(),
  }
}

/**
 * 原生 .node 文件的平台魔数（前几个字节），用来分辨「这份二进制到底是哪个平台的」。
 * 交叉打包时，node-pty 等包的 install 脚本会按打包机（宿主）平台判断是否需要
 * node-gyp 本地编译，与目标平台无关；结果 build/Release 里可能混进宿主平台的
 * 二进制（例：在 Linux 上交叉打 win32 包，build/Release/pty.node 却是 ELF）。
 * node-pty 运行时按 build/Release → build/Debug → prebuilds/<平台> 顺序 require，
 * 错误架构的文件会 require 失败后静默 fallback 到正确的 prebuilds 副本，
 * 功能上不算立即出错，但属于「蒙对」而不是「保证对」，交叉打包后必须清掉。
 */
const NATIVE_MAGIC_CHECK = {
  linux: (buf) =>
    buf.length >= 4 && buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46,
  win32: (buf) => buf.length >= 2 && buf[0] === 0x4d && buf[1] === 0x5a,
  darwin: (buf) => {
    if (buf.length < 4) return false
    const magic = buf.readUInt32BE(0)
    // 32/64-bit Mach-O，大端/小端两种字节序，以及 fat/universal 二进制
    return [0xfeedface, 0xcefaedfe, 0xfeedfacf, 0xcffaedfe, 0xcafebabe, 0xbebafeca].includes(
      magic,
    )
  },
}

function nativeBinaryMatchesPlatform(filePath, platform) {
  const check = NATIVE_MAGIC_CHECK[platform]
  if (!check) return true
  const fd = fs.openSync(filePath, 'r')
  try {
    const buf = Buffer.alloc(4)
    fs.readSync(fd, buf, 0, 4, 0)
    return check(buf)
  } finally {
    fs.closeSync(fd)
  }
}

/**
 * 只清「build/Release」「build/Debug」这两个 loadNativeModule 会最先尝试的目录里、
 * 魔数与目标平台不符的 .node 文件；不动 prebuilds/** 下其它平台的副本（那些是
 * node-pty 本身就会在任意平台随包携带的多平台预编译，无害，也不是本次目标）。
 */
function pruneMismatchedNativeBuilds(stageDir, platform) {
  const nodeModulesDir = path.join(stageDir, 'node_modules')
  if (!fs.existsSync(nodeModulesDir)) return
  const stack = [nodeModulesDir]
  while (stack.length) {
    const dir = stack.pop()
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const full = path.join(dir, entry.name)
      if (entry.name === 'build') {
        for (const sub of ['Release', 'Debug']) {
          const subDir = path.join(full, sub)
          if (!fs.existsSync(subDir)) continue
          for (const f of fs.readdirSync(subDir)) {
            if (!f.endsWith('.node')) continue
            const nodeFile = path.join(subDir, f)
            if (!nativeBinaryMatchesPlatform(nodeFile, platform)) {
              console.log(
                `[pack] 清理交叉打包混入的宿主平台原生模块: ${path.relative(stageDir, nodeFile)}`,
              )
              fs.rmSync(nodeFile)
            }
          }
        }
      } else {
        stack.push(full)
      }
    }
  }
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dest, { recursive: true })
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name)
    const to = path.join(dest, name)
    if (fs.statSync(from).isDirectory()) copyDir(from, to)
    else copyFile(from, to)
  }
}

function writeStartBat(dest) {
  fs.writeFileSync(dest, windowsStartBat(), 'utf8')
}

const DOWNLOAD_TIMEOUT_MS = 90_000
const DOWNLOAD_RETRIES = 3

function downloadHttps(url, dest) {
  return new Promise((resolve, reject) => {
    const go = (u, hops = 0) => {
      if (hops > 8) return reject(new Error(`下载重定向过多: ${url}`))
      const req = https.get(
        u,
        { headers: { 'User-Agent': 'oh-my-co-work-pack' }, timeout: DOWNLOAD_TIMEOUT_MS },
        (res) => {
          const loc = res.headers.location
          if (res.statusCode >= 300 && res.statusCode < 400 && loc) {
            res.resume()
            return go(loc, hops + 1)
          }
          if (res.statusCode !== 200) {
            res.resume()
            return reject(new Error(`下载失败 ${res.statusCode}: ${u}`))
          }
          fs.mkdirSync(path.dirname(dest), { recursive: true })
          const out = fs.createWriteStream(dest)
          res.pipe(out)
          out.on('finish', () => out.close((err) => (err ? reject(err) : resolve(dest))))
          out.on('error', reject)
        },
      )
      req.on('timeout', () => req.destroy(new Error(`下载超时: ${u}`)))
      req.on('error', reject)
    }
    go(url)
  })
}

function unzipTo(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true })
  execFileSync('unzip', ['-q', '-o', zipPath, '-d', destDir], { stdio: 'inherit' })
}

/**
 * 交叉打包时，npm install --ignore-scripts 不会跑 prebuild-install，
 * 而 prebuild-install / node-gyp 在受限 CI（nproc=2、无 Python）上会
 * SIGABRT（exit 134）或长时间挂起。改为用已有的 downloadHttps 直接
 * 拉 GitHub Release 上的预编译二进制并解压到模块目录。
 *
 * - better-sqlite3：按 {version}-node-v{abi}-{platform}-{arch}.tar.gz 约定拉取
 * - node-pty：npm 包自带多平台 prebuilds/，无需额外下载
 *
 * 失败仅告警不阻断（运行时有 node:sqlite / 无 PTY 降级路径）。
 */
async function fetchCrossPrebuilds(stage, target, { abi = process.versions.modules, strict = false } = {}) {
  const bs3Version = (() => {
    try {
      return readJson(path.join(stage, 'node_modules/better-sqlite3/package.json')).version
    } catch {
      return null
    }
  })()
  if (bs3Version) {
    const name = `better-sqlite3-v${bs3Version}-node-v${abi}-${target.platform}-${target.arch}.tar.gz`
    const urls = [
      `https://github.com/WiseLibs/better-sqlite3/releases/download/v${bs3Version}/${name}`,
      `https://registry.npmmirror.com/-/binary/better-sqlite3/v${bs3Version}/${name}`,
    ]
    const bs3Dir = path.join(stage, 'node_modules/better-sqlite3')
    try {
      const tarball = await cachedDownload(urls, name, { minBytes: 200 * 1024 })
      execFileSync('tar', ['-xzf', tarball, '-C', bs3Dir], { stdio: 'inherit' })
      console.log(`[pack] better-sqlite3 prebuild ok (${target.platform}-${target.arch})`)
    } catch (e) {
      if (strict) throw new Error(`better-sqlite3 prebuild 失败（${e?.message || e}）`, { cause: e })
      console.warn(
        `[pack] better-sqlite3 prebuild 失败（${e?.message || e}），继续打包；运行时将走 node:sqlite 降级`,
      )
    }
  }
  const ptyDir = path.join(stage, 'node_modules/node-pty/prebuilds')
  if (fs.existsSync(ptyDir)) {
    console.log('[pack] node-pty 使用 npm 包自带 prebuilds（多平台已随包分发）')
  } else {
    console.warn('[pack] node-pty 缺少 prebuilds，运行时 PTY 可能不可用')
  }
}

async function cachedDownload(urlOrUrls, cacheName, { minBytes = 1024 * 1024 } = {}) {
  const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls]
  const cacheDir = path.join(OUT_ROOT, 'cache')
  const dest = path.join(cacheDir, cacheName)
  if (fs.existsSync(dest) && fs.statSync(dest).size >= minBytes) {
    console.log('[pack] cache hit', cacheName)
    return dest
  }
  const tmp = dest + '.part'
  let lastErr
  for (let attempt = 1; attempt <= DOWNLOAD_RETRIES; attempt++) {
    for (const url of urls) {
      if (fs.existsSync(tmp)) fs.rmSync(tmp)
      try {
        console.log(`[pack] download (${attempt}/${DOWNLOAD_RETRIES})`, url)
        await downloadHttps(url, tmp)
        const size = fs.existsSync(tmp) ? fs.statSync(tmp).size : 0
        if (size < minBytes) {
          throw new Error(`下载不完整: ${size} bytes < ${minBytes}: ${url}`)
        }
        fs.renameSync(tmp, dest)
        return dest
      } catch (e) {
        lastErr = e
        console.error(`[pack] download failed:`, e?.message || e)
      }
    }
  }
  if (fs.existsSync(tmp)) fs.rmSync(tmp)
  throw lastErr || new Error(`下载失败: ${urls.join(' | ')}`)
}

/**
 * Electron 主进程打成单文件 electron/main.js：lib/*.mjs 与 @acw/shared 等依赖由 esbuild
 * 按 import 图收集，缺文件/解析失败在打包期直接报错，而不是用户启动时「无法加载主程序」。
 * bootstrap.cjs / preload.cjs 只 require('electron')，原样拷贝。
 */
async function bundleElectronApp(stage) {
  const electronDest = path.join(stage, 'electron')
  fs.mkdirSync(electronDest, { recursive: true })
  const esbuild = require('esbuild')
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'electron', 'main.js')],
    outfile: path.join(electronDest, 'main.js'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    external: ['electron'],
    logLevel: 'warning',
    banner: {
      js: "import { createRequire as __acwCreateRequire } from 'node:module';const require = __acwCreateRequire(import.meta.url);",
    },
  })
  for (const name of ['bootstrap.cjs', 'preload.cjs', 'icon.png', 'icon.ico']) {
    copyFile(path.join(ROOT, 'electron', name), path.join(electronDest, name))
  }
}

/**
 * Node 官方 dist 的平台命名与压缩格式：
 * win32 → win-{arch}.zip（zip 内根目录 node.exe + dll/exe）；
 * linux → linux-{arch}.tar.xz（bin/node）；
 * darwin → darwin-{arch}.tar.gz（bin/node）。
 */
function nodeDistName(platform, arch) {
  const distPlat = platform === 'win32' ? 'win' : platform
  const ext = platform === 'win32' ? 'zip' : platform === 'darwin' ? 'tar.gz' : 'tar.xz'
  return { name: `node-v${PACK_NODE_VERSION}-${distPlat}-${arch}`, ext }
}

/** tar 包解压到目录（Node 运行时 linux/darwin 用；win32 的 zip 走 unzipTo） */
function untarTo(tarPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true })
  const flag = tarPath.endsWith('.gz') ? '-xzf' : '-xJf'
  execFileSync('tar', [flag, tarPath, '-C', destDir], { stdio: 'inherit' })
}

/**
 * 三平台桌面包（DESK-07）：下载并内嵌 Node 运行时 + Electron，按平台落位：
 * - win32：electron.exe → desktop/oh-my-co-work.exe（盖 .ico）；runtime/node.exe（+dll/exe）
 * - linux：electron → desktop/oh-my-co-work（chmod +x）；runtime/node（chmod +x）
 * - darwin：保留 Electron.app（Electron.app/Contents/MacOS/Electron），不改名 .app；
 *   desktop-launch.mjs 直接调用包内二进制路径。
 *   macOS codesign / 公证不在本脚本范围（需要 Apple Developer 证书），包为未签名便携版。
 * linux 不盖图标：electron/main.js 运行时用 electron/icon.png 设窗口/托盘图标。
 * 二进制命名契约与 desktop-launch.mjs 的 electronExe()、electron/lib/server.mjs 的
 * resolveNodeBin()（win32→runtime/node.exe，其余→runtime/node）保持一致。
 */
async function embedDesktop(stage, platform, arch) {
  await bundleElectronApp(stage)

  // 1) Node 运行时
  const nodeDist = nodeDistName(platform, arch)
  const nodeArchive = `${nodeDist.name}.${nodeDist.ext}`
  const nodeZip = await cachedDownload(
    [
      `https://nodejs.org/dist/v${PACK_NODE_VERSION}/${nodeArchive}`,
      `https://npmmirror.com/mirrors/node/v${PACK_NODE_VERSION}/${nodeArchive}`,
    ],
    nodeArchive,
    { minBytes: 20 * 1024 * 1024 },
  )
  const nodeExtract = path.join(OUT_ROOT, 'cache', `${nodeDist.name}-extract`)
  if (fs.existsSync(nodeExtract)) fs.rmSync(nodeExtract, { recursive: true, force: true })
  if (nodeDist.ext === 'zip') unzipTo(nodeZip, nodeExtract)
  else untarTo(nodeZip, nodeExtract)
  const nodeRoot = path.join(nodeExtract, nodeDist.name)
  const runtime = path.join(stage, 'runtime')
  fs.mkdirSync(runtime, { recursive: true })
  if (platform === 'win32') {
    const nodeExe = path.join(nodeRoot, 'node.exe')
    if (!fs.existsSync(nodeExe)) throw new Error('Node 官方 zip 内缺少 node.exe')
    copyFile(nodeExe, path.join(runtime, 'node.exe'))
    for (const extra of fs.readdirSync(nodeRoot)) {
      if (!/\.(dll|exe)$/i.test(extra)) continue
      if (extra.toLowerCase() === 'node.exe') continue
      copyFile(path.join(nodeRoot, extra), path.join(runtime, extra))
    }
  } else {
    const nodeBin = path.join(nodeRoot, 'bin', 'node')
    if (!fs.existsSync(nodeBin)) {
      throw new Error(`Node 官方 tar 包内缺少 bin/node（${nodeDist.name}）`)
    }
    copyFile(nodeBin, path.join(runtime, 'node'))
    fs.chmodSync(path.join(runtime, 'node'), 0o755)
    console.log(`[pack] runtime/node ready (${platform}-${arch})`)
  }

  // 2) Electron（win32/linux/darwin 官方发行物都是 zip）
  const electronName = `electron-v${PACK_ELECTRON_VERSION}-${platform}-${arch}`
  const electronZip = await cachedDownload(
    [
      // 国内/受限网络优先镜像，失败再走官方 GitHub Release
      `https://npmmirror.com/mirrors/electron/${PACK_ELECTRON_VERSION}/${electronName}.zip`,
      `https://github.com/electron/electron/releases/download/v${PACK_ELECTRON_VERSION}/${electronName}.zip`,
    ],
    `${electronName}.zip`,
    { minBytes: 80 * 1024 * 1024 },
  )
  const desktop = path.join(stage, 'desktop')
  if (fs.existsSync(desktop)) fs.rmSync(desktop, { recursive: true, force: true })
  unzipTo(electronZip, desktop)

  if (platform === 'win32') {
    const electronExe = path.join(desktop, 'electron.exe')
    if (!fs.existsSync(electronExe)) throw new Error('Electron zip 内缺少 electron.exe')
    const brandedExe = path.join(desktop, 'oh-my-co-work.exe')
    fs.renameSync(electronExe, brandedExe)
    const ico = path.join(ROOT, 'electron', 'icon.ico')
    const { stampWinExeIcon } = await import('./win-exe-icon.mjs')
    stampWinExeIcon(brandedExe, ico)
    console.log('[pack] stamped icon onto desktop/oh-my-co-work.exe')
  } else if (platform === 'linux') {
    const electronBin = path.join(desktop, 'electron')
    if (!fs.existsSync(electronBin)) throw new Error('Electron zip 内缺少 electron 可执行文件')
    fs.renameSync(electronBin, path.join(desktop, 'oh-my-co-work'))
    fs.chmodSync(path.join(desktop, 'oh-my-co-work'), 0o755)
    console.log('[pack] linux desktop binary ready (desktop/oh-my-co-work)')
  } else {
    // darwin：保持 Electron.app 包结构（改名 .app 需连动 Info.plist，收益低）。
    // codesign / 公证需要 Apple Developer 证书，未签名便携版见 README 说明。
    const appBin = path.join(desktop, 'Electron.app', 'Contents', 'MacOS', 'Electron')
    if (!fs.existsSync(appBin)) {
      throw new Error('Electron zip 内缺少 Electron.app/Contents/MacOS/Electron')
    }
    console.log('[pack] darwin desktop ready (Electron.app, unsigned)')
  }
  copyFile(path.join(ROOT, 'scripts', 'desktop-launch.mjs'), path.join(stage, 'desktop-launch.mjs'))
}

function writeStartSh(dest) {
  fs.writeFileSync(
    dest,
    [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'cd "$(dirname "$0")"',
      '# 桌面包（win32/linux/darwin 通用布局）：优先用包内 node 拉起桌面窗口',
      'if [ -f desktop-launch.mjs ] && [ -x runtime/node ] && [ -d desktop ]; then',
      '  echo "[acw] 正在启动 oh-my-co-work 桌面窗口…"',
      '  echo "[acw] 提示：关闭窗口默认藏托盘，托盘「退出」才停服务"',
      '  exec ./runtime/node desktop-launch.mjs',
      'fi',
      'if ! command -v node >/dev/null 2>&1; then',
      '  echo "[acw] 未检测到 Node.js，请先安装 Node.js 18+ ：https://nodejs.org"',
      '  exit 1',
      'fi',
      'echo "[acw] 正在启动 oh-my-co-work（运行包，无需 npm install）…"',
      'echo "[acw] 提示：关闭本窗口或 Ctrl+C 即可结束服务（关浏览器不会停）"',
      'exec node start.mjs',
      '',
    ].join('\n'),
    'utf8',
  )
  try {
    fs.chmodSync(dest, 0o755)
  } catch {
    /* ignore */
  }
}

/** 发布包专用启动器：优先直跑；Node ABI 不匹配时自动适配 better-sqlite3 */
function writeStartMjs(dest) {
  fs.writeFileSync(
    dest,
    `/**
 * 运行包一键启动（已含打包产物与 node_modules）
 * 通用适配：本机 Node 与打包 ABI 不一致时，自动按当前 Node 拉取/重建 better-sqlite3
 */
import { spawn, exec, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.ACW_PORT || 3780)
const AUTO_EXIT = process.env.ACW_AUTO_EXIT === '1' || process.env.ACW_AUTO_EXIT === 'true' || process.env.ACW_AUTO_EXIT === 'yes'
const ENTRY = path.join(ROOT, 'server', 'dist', 'index.cjs')
const require = createRequire(path.join(ROOT, 'package.json'))
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function log(...a) {
  console.log('[acw-start]', ...a)
}

function waitHealth(timeoutMs = 60_000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(\`http://127.0.0.1:\${PORT}/api/health\`, (res) => {
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
  if (plat === 'win32') exec(\`start "" "\${url}"\`)
  else if (plat === 'darwin') exec(\`open "\${url}"\`)
  else exec(\`xdg-open "\${url}"\`)
}

function clearSqliteCache() {
  for (const k of Object.keys(require.cache || {})) {
    if (/better-sqlite3|[/\\\\]bindings[/\\\\]/i.test(k)) delete require.cache[k]
  }
}

function probeSqlite() {
  clearSqliteCache()
  try {
    const Database = require(path.join(ROOT, 'node_modules', 'better-sqlite3'))
    // require 本身不一定加载 .node；打开内存库才会触发原生模块与 ABI 校验
    const db = new Database(':memory:')
    db.close()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e }
  }
}

function runNpm(args, cwd = ROOT) {
  return spawnSync(NPM, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  })
}

function sqliteDepRange() {
  try {
    return (
      require(path.join(ROOT, 'package.json')).dependencies?.['better-sqlite3'] ||
      '^11.7.0'
    )
  } catch {
    return '^11.7.0'
  }
}

function nodeMajor() {
  return Number(String(process.versions.node || '0').split('.')[0]) || 0
}

function canUseBuiltinSqlite() {
  return nodeMajor() >= 22
}

/** 通用适配：绝不先删掉整个模块（避免 Windows 装失败后变成空目录 ENOENT） */
function adaptSqliteForCurrentNode() {
  log('检测到 better-sqlite3 与当前 Node 不匹配，开始自动适配…')
  log('本机 Node', process.version, 'ABI', process.versions.modules)

  // 1) 不删除模块，直接按当前 Node 重装（拉预编译；Windows 通常无需 VS）
  log('步骤 1/2：npm install better-sqlite3（预编译优先，保留原文件直到成功）…')
  let r = runNpm([
    'install',
    'better-sqlite3@' + sqliteDepRange(),
    '--omit=dev',
    '--no-audit',
    '--no-fund',
    '--force',
  ])
  if (probeSqlite().ok) return true

  // 2) rebuild 兜底（需要本机编译工具）
  log('步骤 2/2：npm rebuild better-sqlite3 …')
  r = runNpm(['rebuild', 'better-sqlite3'])
  if (r.status === 0 && probeSqlite().ok) return true

  return false
}

async function main() {
  if (!fs.existsSync(ENTRY)) {
    console.error('[acw-start] 缺少打包入口 server/dist/index.cjs，请使用官方运行包')
    process.exit(1)
  }

  let probe = probeSqlite()
  if (!probe.ok) {
    log('better-sqlite3 加载失败：', String(probe.error?.message || probe.error || ''))
    // Node 22+：服务端可回退 node:sqlite，无需原生模块也能启动
    if (canUseBuiltinSqlite()) {
      log('本机 Node >= 22，将使用内置 node:sqlite 启动（无需 VS / rebuild）')
    } else {
      log('尝试按当前 Node 自动适配 better-sqlite3…')
      const ok = adaptSqliteForCurrentNode()
      probe = probeSqlite()
      if (!ok || !probe.ok) {
        console.error('[acw-start] 自动适配失败：')
        console.error(probe.error)
        console.error(
          '[acw-start] 请改用 Node 22+（可用内置 sqlite）或 Node 20 LTS：https://nodejs.org',
        )
        console.error(
          '[acw-start] 也可在本解压目录手动执行：npm install better-sqlite3 --omit=dev',
        )
        process.exit(1)
      }
      log('better-sqlite3 已适配当前 Node', process.version)
    }
  }

  const env = {
    ...process.env,
    ACW_PORT: String(PORT),
    ACW_AUTO_EXIT: AUTO_EXIT ? '1' : '0',
  }
  log('运行包启动', ROOT)
  log(\`Node \${process.version}  端口 :\${PORT}  auto-exit=\${AUTO_EXIT ? 'on' : 'off'}\`)
  const child = spawn(process.execPath, [ENTRY], {
    cwd: ROOT,
    env,
    stdio: 'inherit',
    windowsHide: false,
  })

  const killChild = () => {
    if (!child || child.killed || child.exitCode != null) return
    const pid = child.pid
    try {
      if (process.platform === 'win32' && pid) {
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
  child.on('exit', (code) => process.exit(code || 0))

  try {
    await waitHealth()
  } catch (e) {
    log(e.message)
    shutdown()
    process.exit(1)
  }
  const url = \`http://127.0.0.1:\${PORT}/\`
  log('打开浏览器', url)
  if (AUTO_EXIT) log('提示：已开启 ACW_AUTO_EXIT，关闭浏览器后后台可能退出')
  else log('提示：关闭本窗口（或 Ctrl+C）即可结束服务；关浏览器不会停服务')
  openBrowser(url)
}

main().catch((e) => {
  console.error('[acw-start] FAIL', e.message || e)
  process.exit(1)
})
`,
    'utf8',
  )
}

function parseCurrentTxt(raw) {
  const map = {}
  for (const line of String(raw || '').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#') || t.startsWith('<<<<<<<') || t.startsWith('=======') || t.startsWith('>>>>>>>')) {
      continue
    }
    const i = t.indexOf('=')
    if (i <= 0) continue
    map[t.slice(0, i)] = t.slice(i + 1)
  }
  return map
}

function platformFromZipName(name) {
  if (/desktop\.zip$/i.test(name)) return null
  // oh-my-co-work-v2-linux-x64.zip → linux-x64
  const m = String(name).match(/^oh-my-co-work-v\d+-(.+)\.zip$/i)
  return m ? m[1] : null
}

function majorFromZipName(name) {
  const m = String(name).match(/^oh-my-co-work-v(\d+)-/i)
  return m ? Number(m[1]) : null
}

/** 只保留当前大版本的运行包；旧大版本 zip 全部删掉 */
function pruneOlderMajorZips(keepMajor) {
  if (!fs.existsSync(PACKAGES_DIR)) return
  for (const name of fs.readdirSync(PACKAGES_DIR)) {
    if (!name.endsWith('.zip') && !name.endsWith('.build.json')) continue
    const m = majorFromZipName(name)
    if (m == null || m === keepMajor) continue
    const full = path.join(PACKAGES_DIR, name)
    fs.rmSync(full)
    console.log('[pack] pruned older-major', name)
  }
}

function buildMetaPathForZip(zipName) {
  return path.join(PACKAGES_DIR, `${zipName.slice(0, -4)}.build.json`)
}

function readBuildMetaForZip(zipName) {
  const p = buildMetaPathForZip(zipName)
  if (!fs.existsSync(p)) return null
  try {
    return readJson(p)
  } catch {
    return null
  }
}

function writePackagesManifest({ ver, major, sha, builtAt, plat, gitZipName, size }) {
  const curPath = path.join(PACKAGES_DIR, 'CURRENT.txt')
  const prev = fs.existsSync(curPath)
    ? parseCurrentTxt(fs.readFileSync(curPath, 'utf8'))
    : {}

  // 以目录内实际 zip 为准，合并各平台元数据（避免并行 CI 互相冲掉）
  const files = fs
    .readdirSync(PACKAGES_DIR)
    .filter((n) => n.endsWith('.zip'))
    .sort()

  const byPlat = {}
  for (const f of files) {
    const p = platformFromZipName(f)
    if (!p) continue
    const full = path.join(PACKAGES_DIR, f)
    const meta = readBuildMetaForZip(f)
    byPlat[p] = {
      file: f,
      size: fs.statSync(full).size,
      commit: meta?.sourceCommit || prev[`commit.${p}`] || prev.commit || '',
      built: meta?.builtAt || prev[`built.${p}`] || '',
    }
  }
  byPlat[plat] = {
    file: gitZipName,
    size,
    commit: sha,
    built: builtAt,
  }

  const platOrder = Object.keys(byPlat).sort()
  const tableRows = platOrder.map((p) => {
    const b = byPlat[p]
    const commit = b.commit ? `\`${String(b.commit).slice(0, 12)}\`` : '—'
    return `| ${p} | [\`${b.file}\`](./${b.file}) | ${b.size} | ${commit} | ${b.built || '—'} |`
  })

  const lines = [
    '# oh-my-co-work 运行包（提交在 git）',
    '',
    '这是 **打包后的可运行压缩包**（前端 dist + 后端 bundle + 内置 node_modules），**不是源码**。',
    '解压后直接启动，**不需要再执行 npm install**（仍需本机安装 Node.js ≥ 18）。',
    '',
    '**桌面窗口包**（Windows / macOS / Linux，内含 Electron + Node，一般不用装 Node.js）体积超过 GitHub 仓库 100MB 限制，不进本目录；请到 [latest release](https://github.com/371684029/oh-my-co-work/releases/tag/latest) 下载对应平台的 `*-desktop.zip`（macOS 为未签名便携版）。',
    '',
    '## 版本策略',
    '',
    '- **同大版本**：覆盖替换同平台 zip（小版本只留最新）',
    '- **新大版本**：只保留当前大版本包，旧大版本 zip 全部删除',
    '- **多平台**：linux / win32 / darwin 各一份（当前大版本内互不覆盖）',
    '- **发布门禁**：三平台包内 `BUILD_INFO.json` 的版本、源码提交必须一致，并包含当前熔炉图集；任一不符则不发布 latest',
    '',
    '## 仓库内文件',
    '',
    '| 平台 | 文件 | 大小 | 源码提交 | 构建时间 |',
    '|------|------|------|----------|----------|',
    ...tableRows,
    '',
    `版本：\`${ver}\`（大版本 v${major}）`,
    '',
    '## 启动',
    '',
    '解压对应平台的 zip → Windows 双击 `start.bat`（浏览器）；macOS/Linux 运行 `./start.sh`。',
    '桌面窗口请用 Release 里对应平台的 `*-desktop.zip`。',
    '',
  ]
  fs.writeFileSync(path.join(PACKAGES_DIR, 'README.md'), lines.join('\n'), 'utf8')

  const curLines = [
    `version=${ver}`,
    `major=${major}`,
    `kind=runtime-bundle`,
    `needsNpmInstall=false`,
    `policy=one-major-latest-only; same-major-per-platform-overwrite; delete-older-majors`,
    '# 各平台产物（按平台键合并，避免并行 CI 冲突）',
  ]
  for (const p of platOrder) {
    const b = byPlat[p]
    curLines.push(`file.${p}=${b.file}`)
    curLines.push(`size.${p}=${b.size}`)
    if (b.commit) curLines.push(`commit.${p}=${b.commit}`)
    if (b.built) curLines.push(`built.${p}=${b.built}`)
  }
  fs.writeFileSync(curPath, curLines.join('\n') + '\n', 'utf8')
}

function runEsbuild(args) {
  // CJS：避免 express 等 CJS 依赖在 ESM bundle 里 Dynamic require 失败
  // 并用 define 补上 import.meta.url（db.js 用来定位 ROOT）
  const esbuild = require('esbuild')
  return esbuild.build({
    entryPoints: [args.entry],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: args.outfile,
    external: ['better-sqlite3', 'node-pty'],
    logLevel: 'warning',
    banner: {
      js: "const __import_meta_url=require('url').pathToFileURL(__filename).href;",
    },
    define: {
      'import.meta.url': '__import_meta_url',
    },
  })
}

function main() {
  return mainAsync().catch((e) => {
    console.error('[pack] FAIL', e.message || e)
    process.exit(1)
  })
}

async function mainAsync() {
  const pkg = readJson(path.join(ROOT, 'package.json'))
  const aboutPath = path.join(ROOT, 'server/config/about.json')
  let ver = pkg.version || '0.0.0'
  try {
    ver = readJson(aboutPath).version || ver
  } catch {
    /* ignore */
  }
  const major = majorOf(ver)
  const sha = gitCommit()
  const builtAt = new Date().toISOString()
  const target = packTarget()
  const desktopPack = wantDesktopPack()
  const plat = target.tag
  const folderName = desktopPack
    ? `oh-my-co-work-v${major}-${plat}-desktop`
    : `oh-my-co-work-v${major}-${plat}`
  const stage = path.join(OUT_ROOT, folderName)
  const gitZipName = `${folderName}.zip`
  const gitZipPath = path.join(PACKAGES_DIR, gitZipName)

  console.log(
    '[pack] kind=',
    desktopPack ? 'desktop-bundle' : 'runtime-bundle',
    'platform=',
    plat,
    'version=',
    ver,
    target.cross ? `(cross-pack from ${platformTag()})` : '',
  )

  // ACW_PACK_SKIP_WEB_BUILD=1：复用已有 web/dist（本机 nproc 受限时可先单独 npm run build -w web）
  const skipWeb = ['1', 'true', 'yes'].includes(
    String(process.env.ACW_PACK_SKIP_WEB_BUILD || '').toLowerCase(),
  )
  if (skipWeb) {
    if (!fs.existsSync(path.join(ROOT, 'web/dist/index.html'))) {
      throw new Error('ACW_PACK_SKIP_WEB_BUILD=1 但 web/dist 不存在，请先 npm run build -w web')
    }
    console.log('[pack] skip web build (ACW_PACK_SKIP_WEB_BUILD)，复用 web/dist…')
  } else {
    console.log('[pack] build web…')
    sh('npm', ['run', 'build', '-w', 'web'])
  }

  if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true })
  fs.mkdirSync(path.join(stage, 'server', 'dist'), { recursive: true })
  fs.mkdirSync(path.join(stage, 'web'), { recursive: true })

  const bundleOut = path.join(stage, 'server', 'dist', 'index.cjs')
  console.log('[pack] bundle server →', bundleOut)
  await runEsbuild({
    entry: path.join(ROOT, 'server/src/index.js'),
    outfile: bundleOut,
  })

  // 配置与前端产物（无源码）
  copyDir(path.join(ROOT, 'server/config'), path.join(stage, 'server/config'))
  copyDir(path.join(ROOT, 'web/dist'), path.join(stage, 'web/dist'))
  if (fs.existsSync(path.join(ROOT, 'web/public'))) {
    copyDir(path.join(ROOT, 'web/public'), path.join(stage, 'web/public'))
  }

  // 最小 package.json：仅声明运行时 native 依赖（已预装，用户不用装）
  const distPkg = {
    name: 'oh-my-co-work',
    version: ver,
    private: true,
    type: 'module',
    main: desktopPack ? 'electron/bootstrap.cjs' : undefined,
    description: 'oh-my-co-work 运行包（打包产物，非源码）',
    engines: { node: '>=18' },
    dependencies: {
      'better-sqlite3':
        readJson(path.join(ROOT, 'server/package.json')).dependencies[
          'better-sqlite3'
        ] || '^11.7.0',
      'node-pty':
        readJson(path.join(ROOT, 'server/package.json')).dependencies[
          'node-pty'
        ] || '^1.1.0',
    },
  }
  if (!distPkg.main) delete distPkg.main
  fs.writeFileSync(
    path.join(stage, 'package.json'),
    JSON.stringify(distPkg, null, 2) + '\n',
    'utf8',
  )

  console.log('[pack] install runtime deps inside package (prebake node_modules)…')
  // 交叉打包时强制跳过 install 脚本：prebuild-install / node-gyp 在受限容器
  // （nproc=2、无 Python）上会 core dump（SIGABRT / exit 134），即使目标是拉
  // 预编译二进制也会先跑宿主平台的脚本。改为 --ignore-scripts 后单独拉取。
  const ignoreScripts =
    target.cross ||
    ['1', 'true', 'yes'].includes(
      String(process.env.ACW_PACK_IGNORE_NATIVE_SCRIPTS || '').toLowerCase(),
    )
  const installArgs = ['install', '--omit=dev', '--no-audit', '--no-fund']
  if (ignoreScripts) installArgs.push('--ignore-scripts')
  sh('npm', installArgs, {
    cwd: stage,
    env: target.cross
      ? {
          npm_config_platform: target.platform,
          npm_config_arch: target.arch,
        }
      : {},
  })

  if (target.cross || desktopPack) {
    // 桌面包由内嵌 runtime/node 跑服务端：即便同平台打包，也要覆盖成 runtime ABI 的二进制，
    // 否则在 Node 22 机器上打出的包会带 ABI 127 的 .node，桌面端服务起不来
    const abi = desktopPack ? runtimeNodeAbi() : process.versions.modules
    console.log(`[pack] HTTP 直拉目标平台原生二进制（node ABI ${abi}）…`)
    // 内嵌 Node 20 没有 node:sqlite 兜底，桌面包拉不到 better-sqlite3 必须失败
    await fetchCrossPrebuilds(stage, target, { abi, strict: desktopPack })
  }
  if (target.cross) {
    console.log('[pack] 交叉打包，核对原生模块架构（避免混入宿主平台二进制）…')
    pruneMismatchedNativeBuilds(stage, target.platform)
  }

  writeStartMjs(path.join(stage, 'start.mjs'))
  writeStartBat(path.join(stage, 'start.bat'))
  writeStartSh(path.join(stage, 'start.sh'))

  if (desktopPack) {
    console.log(`[pack] embed desktop (Electron + Node runtime) for ${plat}…`)
    await embedDesktop(stage, target.platform, target.arch)
  }

  const desktopOsName = plat.startsWith('win32')
    ? 'Windows'
    : plat.startsWith('darwin')
      ? 'macOS'
      : 'Linux'
  const userReadme = [
    '# oh-my-co-work 运行包',
    '',
    `版本：${ver} · 平台：${plat} · 提交：${sha}`,
    '',
    '本压缩包是**打包后的可运行程序**（不是源码仓库）。',
    '',
    '## 需要',
    '',
    desktopPack
      ? `- ${desktopOsName}。包内已带 Electron 窗口和 Node 运行时，**一般不用再装 Node.js**。`
      : '- 本机已安装 Node.js ≥ 18（https://nodejs.org；推荐 Node 22+）',
    '- **通常不需要**再执行 npm install（依赖已打进包内）',
    ...(desktopPack
      ? []
      : ['- Node 22+：即使 better-sqlite3 与本机 Node 不匹配，也会自动用内置 sqlite 启动']),
    ...(desktopPack && plat.startsWith('darwin')
      ? [
          '- **macOS 未签名便携版**：未经 Apple 公证，首次打开若被 Gatekeeper 拦截，请右键 → 打开，或执行 `xattr -dr com.apple.quarantine .`（代码签名/公证需 Apple 开发者证书，暂未提供）',
        ]
      : []),
    '',
    '## 启动',
    '',
    '| 系统 | 操作 |',
    '|------|------|',
    ...(desktopPack
      ? [
          plat.startsWith('win32')
            ? '| Windows | 双击 start.bat（打开桌面窗口；关窗藏托盘，托盘「退出」才停服务） |'
            : `| ${desktopOsName} | ./start.sh（打开桌面窗口；或 ./runtime/node desktop-launch.mjs） |`,
        ]
      : [
          '| Windows | 双击 start.bat（需本机 Node.js；会打开浏览器） |',
          '| macOS / Linux | ./start.sh 或 node start.mjs |',
        ]),
    '',
    desktopPack
      ? '关闭桌面窗口默认藏到托盘，不会停后台。请用托盘菜单「退出」。'
      : '关闭浏览器不会自动停服务；请在启动窗口 Ctrl+C 结束。',
    '',
    '数据目录：解压目录下的 data/',
    '',
  ].join('\n')
  fs.writeFileSync(path.join(stage, 'README.txt'), userReadme, 'utf8')
  fs.writeFileSync(path.join(stage, 'README.md'), userReadme, 'utf8')
  fs.writeFileSync(
    path.join(stage, 'VERSION.txt'),
    [
      `name=oh-my-co-work`,
      `kind=runtime-bundle`,
      `version=${ver}`,
      `major=${major}`,
      `platform=${plat}`,
      `commit=${sha}`,
      `built=${builtAt}`,
      `needsNpmInstall=false`,
      `autoExit=default-off`,
    ].join('\n') + '\n',
    'utf8',
  )
  const buildInfo = {
    schemaVersion: 1,
    name: 'oh-my-co-work',
    kind: desktopPack ? 'desktop-bundle' : 'runtime-bundle',
    desktop: desktopPack ? 'electron+bundled-node' : 'browser',
    version: ver,
    major,
    platform: plat,
    sourceCommit: sha,
    builtAt,
    needsNpmInstall: false,
    requiredAssets: ['web/dist/assets/spritesheet-*.webp'],
  }
  fs.writeFileSync(
    path.join(stage, 'BUILD_INFO.json'),
    JSON.stringify(buildInfo, null, 2) + '\n',
    'utf8',
  )

  // 保险：不要把源码误拷进包
  for (const bad of ['server/src', 'web/src', 'shared', 'docs', '.git']) {
    const p = path.join(stage, bad)
    if (fs.existsSync(p)) {
      throw new Error(`[pack] refuse: source path leaked into stage: ${bad}`)
    }
  }

  fs.mkdirSync(OUT_ROOT, { recursive: true })
  const zipPath = path.join(OUT_ROOT, gitZipName)
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath)

  console.log('[pack] zip…', zipPath)
  if (process.platform === 'win32') {
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path '${stage.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
      ],
      { stdio: 'inherit' },
    )
  } else {
    // -y 保留符号链接：Electron.app 的 *.framework 依赖 Versions/Current 等链接，展开成实体文件
    // 会破坏代码签名，Apple Silicon 上直接被系统杀掉。win32 包不需要（解压工具也不认 symlink）。
    const zipArgs = target.platform === 'win32' ? ['-r', '-q'] : ['-r', '-q', '-y']
    execFileSync('zip', [...zipArgs, zipPath, folderName], {
      cwd: OUT_ROOT,
      stdio: 'inherit',
    })
  }

  fs.mkdirSync(PACKAGES_DIR, { recursive: true })
  const size = fs.statSync(zipPath).size

  if (desktopPack || size > GIT_ZIP_MAX_BYTES) {
    console.log(
      '[pack] ok',
      zipPath,
      `(${size} bytes)`,
      desktopPack
        ? '——桌面包不写入 packages/（GitHub 单文件 100MB 限制）'
        : '——超过 git 体积上限，未写入 packages/',
    )
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        [
          `artifact=${zipPath}`,
          `artifact_name=${gitZipName}`,
          `version=${ver}`,
          `major=${major}`,
          `platform=${plat}`,
          `desktop=1`,
        ].join('\n') + '\n',
      )
    }
    return zipPath
  }

  // 去掉旧的无平台后缀包名（历史遗留）
  const legacy = path.join(PACKAGES_DIR, `oh-my-co-work-v${major}.zip`)
  if (fs.existsSync(legacy)) {
    fs.rmSync(legacy)
    console.log('[pack] removed legacy', legacy)
  }
  fs.copyFileSync(zipPath, gitZipPath)
  fs.writeFileSync(
    buildMetaPathForZip(gitZipName),
    JSON.stringify(buildInfo, null, 2) + '\n',
    'utf8',
  )
  // 一个大版本只留当前最新：删掉其它大版本的全部运行包
  pruneOlderMajorZips(major)

  const gitSize = fs.statSync(gitZipPath).size
  writePackagesManifest({ ver, major, sha, builtAt, plat, gitZipName, size: gitSize })

  console.log('[pack] ok', gitZipPath, `(${gitSize} bytes)`)
  console.log('[pack] user: unzip → start.bat / ./start.sh （无需 npm install）')

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      [
        `artifact=${zipPath}`,
        `artifact_name=${gitZipName}`,
        `version=${ver}`,
        `major=${major}`,
        `platform=${plat}`,
        `git_zip=packages/${gitZipName}`,
      ].join('\n') + '\n',
    )
  }
  return gitZipPath
}

/** 仅根据 packages/*.zip 重写 README/CURRENT（解决并行 CI 冲突后调用） */
function regenerateManifestOnly() {
  const aboutPath = path.join(ROOT, 'server/config/about.json')
  let ver = '0.0.0'
  try {
    ver = readJson(aboutPath).version || ver
  } catch {
    try {
      ver = readJson(path.join(ROOT, 'package.json')).version || ver
    } catch {
      /* ignore */
    }
  }
  const major = majorOf(ver)
  const plat = platformTag()
  pruneOlderMajorZips(major)
  const files = fs.existsSync(PACKAGES_DIR)
    ? fs.readdirSync(PACKAGES_DIR).filter((n) => n.endsWith('.zip')).sort()
    : []
  if (!files.length) {
    console.log('[pack] no zips in packages/, skip manifest')
    return
  }
  // 用本机平台对应文件作“锚点”，其余从目录扫描合并
  const mine =
    files.find((f) => f.includes(`-${plat}.`)) || files[files.length - 1]
  const size = fs.statSync(path.join(PACKAGES_DIR, mine)).size
  const meta = readBuildMetaForZip(mine)
  writePackagesManifest({
    ver,
    major,
    sha: meta?.sourceCommit || '',
    builtAt: meta?.builtAt || '',
    plat: platformFromZipName(mine) || plat,
    gitZipName: mine,
    size,
  })
  console.log('[pack] regenerated packages/README.md + CURRENT.txt from', files.join(', '))
}

if (process.argv.includes('--manifest-only')) {
  regenerateManifestOnly()
} else {
  main()
}
