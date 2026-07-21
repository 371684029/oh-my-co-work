#!/usr/bin/env node
/**
 * 打【运行包】压缩包（不是源码树）：
 * - 前端 vite build → web/dist
 * - 后端 esbuild 打成 server/dist/index.js（不含 server/src）
 * - 在包内预装 better-sqlite3 等运行依赖（用户不必再 npm install）
 *
 * 产物（提交进 git）：
 *   packages/apple-co-work-v{MAJOR}-{platform}-{arch}.zip
 *   · 同大版本 + 同平台：覆盖替换（小版本替代）
 *   · 新大版本 / 其它平台：增量保留
 *
 * 用法：npm run pack
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

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

function gitShort() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT })
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
  fs.writeFileSync(
    dest,
    [
      '@echo off',
      'chcp 65001 >nul',
      'cd /d "%~dp0"',
      'where node >nul 2>nul',
      'if errorlevel 1 (',
      '  echo [acw] 未检测到 Node.js，请先安装 Node.js 18+ ：https://nodejs.org',
      '  pause',
      '  exit /b 1',
      ')',
      'echo [acw] 正在启动 apple-co-work（运行包，无需 npm install）…',
      'node start.mjs',
      'if errorlevel 1 pause',
      '',
    ].join('\r\n'),
    'utf8',
  )
}

function writeStartSh(dest) {
  fs.writeFileSync(
    dest,
    [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'cd "$(dirname "$0")"',
      'if ! command -v node >/dev/null 2>&1; then',
      '  echo "[acw] 未检测到 Node.js，请先安装 Node.js 18+ ：https://nodejs.org"',
      '  exit 1',
      'fi',
      'echo "[acw] 正在启动 apple-co-work（运行包，无需 npm install）…"',
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

/** 发布包专用启动器：不装依赖，直接跑打包后的 server/dist */
function writeStartMjs(dest) {
  fs.writeFileSync(
    dest,
    `/**
 * 运行包一键启动（已含打包产物与 node_modules，无需再 npm install）
 */
import { spawn, exec } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.ACW_PORT || 3780)
const AUTO_EXIT = process.env.ACW_AUTO_EXIT !== '0' && process.env.ACW_AUTO_EXIT !== 'false'
const ENTRY = path.join(ROOT, 'server', 'dist', 'index.cjs')

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

if (!fs.existsSync(ENTRY)) {
  console.error('[acw-start] 缺少打包入口 server/dist/index.cjs，请使用官方运行包')
  process.exit(1)
}
if (!fs.existsSync(path.join(ROOT, 'node_modules', 'better-sqlite3'))) {
  console.error('[acw-start] 缺少内置依赖 node_modules/better-sqlite3（运行包应已自带，勿删）')
  process.exit(1)
}

const env = {
  ...process.env,
  ACW_PORT: String(PORT),
  ACW_AUTO_EXIT: AUTO_EXIT ? '1' : '0',
}
log('运行包启动', ROOT)
log(\`端口 :\${PORT}  auto-exit=\${AUTO_EXIT ? 'on' : 'off'}\`)
const child = spawn(process.execPath, [ENTRY], { cwd: ROOT, env, stdio: 'inherit' })
const shutdown = () => {
  try {
    child.kill('SIGTERM')
  } catch {
    /* ignore */
  }
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
child.on('exit', (code) => process.exit(code || 0))

waitHealth()
  .then(() => {
    const url = \`http://127.0.0.1:\${PORT}/\`
    log('打开浏览器', url)
    if (AUTO_EXIT) log('提示：关闭浏览器窗口后，后台将在数秒内自动退出')
    openBrowser(url)
  })
  .catch((e) => {
    log(e.message)
    shutdown()
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
  // apple-co-work-v1-linux-x64.zip → linux-x64
  const m = String(name).match(/^apple-co-work-v\d+-(.+)\.zip$/i)
  return m ? m[1] : null
}

function writePackagesManifest({ ver, major, sha, plat, gitZipName, size }) {
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
    byPlat[p] = {
      file: f,
      size: fs.statSync(full).size,
      commit: prev[`commit.${p}`] || prev.commit || '',
      built: prev[`built.${p}`] || '',
    }
  }
  byPlat[plat] = {
    file: gitZipName,
    size,
    commit: sha,
    built: new Date().toISOString(),
  }

  const platOrder = Object.keys(byPlat).sort()
  const tableRows = platOrder.map((p) => {
    const b = byPlat[p]
    return `| ${p} | [\`${b.file}\`](./${b.file}) | ${b.size} |`
  })

  const lines = [
    '# apple-co-work 运行包（提交在 git）',
    '',
    '这是 **打包后的可运行压缩包**（前端 dist + 后端 bundle + 内置 node_modules），**不是源码**。',
    '解压后直接启动，**不需要再执行 npm install**（仍需本机安装 Node.js ≥ 18）。',
    '',
    '## 版本策略',
    '',
    '- **小版本（同大版本）**：覆盖替换同平台的 `apple-co-work-v{N}-{platform}-{arch}.zip`',
    '- **大版本**：新增 `v{N+1}-…`，旧大版本包保留',
    '- **多平台**：linux / win32 / darwin 各一份，互不覆盖',
    '',
    '## 仓库内文件',
    '',
    '| 平台 | 文件 | 大小 |',
    '|------|------|------|',
    ...tableRows,
    '',
    `版本：\`${ver}\`（大版本 v${major}）`,
    '',
    '## 启动',
    '',
    '解压对应平台的 zip → Windows 双击 `start.bat`；macOS/Linux 运行 `./start.sh`。',
    '',
  ]
  fs.writeFileSync(path.join(PACKAGES_DIR, 'README.md'), lines.join('\n'), 'utf8')

  const curLines = [
    `version=${ver}`,
    `major=${major}`,
    `kind=runtime-bundle`,
    `needsNpmInstall=false`,
    `policy=same-major-same-platform-replace; new-major-or-platform-keep`,
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
    external: ['better-sqlite3'],
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
  const sha = gitShort()
  const plat = platformTag()
  const folderName = `apple-co-work-v${major}-${plat}`
  const stage = path.join(OUT_ROOT, folderName)
  const gitZipName = `${folderName}.zip`
  const gitZipPath = path.join(PACKAGES_DIR, gitZipName)

  console.log('[pack] kind=runtime-bundle platform=', plat, 'version=', ver)

  console.log('[pack] build web…')
  sh('npm', ['run', 'build', '-w', 'web'])

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
    name: 'apple-co-work',
    version: ver,
    private: true,
    type: 'module',
    description: 'apple-co-work 运行包（打包产物，非源码）',
    engines: { node: '>=18' },
    dependencies: {
      'better-sqlite3':
        readJson(path.join(ROOT, 'server/package.json')).dependencies[
          'better-sqlite3'
        ] || '^11.7.0',
    },
  }
  fs.writeFileSync(
    path.join(stage, 'package.json'),
    JSON.stringify(distPkg, null, 2) + '\n',
    'utf8',
  )

  console.log('[pack] install runtime deps inside package (prebake node_modules)…')
  sh('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: stage })

  writeStartMjs(path.join(stage, 'start.mjs'))
  writeStartBat(path.join(stage, 'start.bat'))
  writeStartSh(path.join(stage, 'start.sh'))

  const userReadme = [
    '# apple-co-work 运行包',
    '',
    `版本：${ver} · 平台：${plat} · 提交：${sha}`,
    '',
    '本压缩包是**打包后的可运行程序**（不是源码仓库）。',
    '',
    '## 需要',
    '',
    '- 本机已安装 Node.js ≥ 18（https://nodejs.org）',
    '- **不需要**再执行 npm install（依赖已打进包内）',
    '',
    '## 启动',
    '',
    '| 系统 | 操作 |',
    '|------|------|',
    '| Windows | 双击 start.bat |',
    '| macOS / Linux | ./start.sh 或 node start.mjs |',
    '',
    '关闭浏览器后，后台默认自动退出。',
    '',
    '数据目录：解压目录下的 data/',
    '',
  ].join('\n')
  fs.writeFileSync(path.join(stage, '使用说明.txt'), userReadme, 'utf8')
  fs.writeFileSync(path.join(stage, 'README.md'), userReadme, 'utf8')
  fs.writeFileSync(
    path.join(stage, 'VERSION.txt'),
    [
      `name=apple-co-work`,
      `kind=runtime-bundle`,
      `version=${ver}`,
      `major=${major}`,
      `platform=${plat}`,
      `commit=${sha}`,
      `built=${new Date().toISOString()}`,
      `needsNpmInstall=false`,
      `autoExit=default-on`,
    ].join('\n') + '\n',
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
    execFileSync('zip', ['-r', '-q', zipPath, folderName], {
      cwd: OUT_ROOT,
      stdio: 'inherit',
    })
  }

  fs.mkdirSync(PACKAGES_DIR, { recursive: true })
  // 去掉旧的无平台后缀包名（历史遗留）
  const legacy = path.join(PACKAGES_DIR, `apple-co-work-v${major}.zip`)
  if (fs.existsSync(legacy)) {
    fs.rmSync(legacy)
    console.log('[pack] removed legacy', legacy)
  }
  fs.copyFileSync(zipPath, gitZipPath)

  const size = fs.statSync(gitZipPath).size
  writePackagesManifest({ ver, major, sha, plat, gitZipName, size })

  console.log('[pack] ok', gitZipPath, `(${size} bytes)`)
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
  const sha = gitShort()
  const plat = platformTag()
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
  writePackagesManifest({
    ver,
    major,
    sha,
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
