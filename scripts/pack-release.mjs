#!/usr/bin/env node
/**
 * 打用户可下载压缩包（不含 node_modules；用户机 npm install / 一键启动会装）
 *
 * 产物：
 * - release/…（本机临时，gitignore）
 * - packages/apple-co-work-v{MAJOR}.zip  ← **提交进 git**
 *   · 同大版本（小版本）：覆盖替换
 *   · 新大版本：新增文件，旧大版本包保留（增量）
 *
 * 用法：npm run pack
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_ROOT = path.join(ROOT, 'release')
const PACKAGES_DIR = path.join(ROOT, 'packages')

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opts,
  })
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.status}`)
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

/** 从 1.0.0-dev / 2.1.3 取主版本号 */
function majorOf(ver) {
  const m = String(ver || '0').match(/^(\d+)/)
  return m ? Number(m[1]) : 0
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
  if (path.basename(dest) === 'start.sh') {
    try {
      fs.chmodSync(dest, 0o755)
    } catch {
      /* Windows 上可能无效，忽略 */
    }
  }
}

function copyDir(src, dest, { ignore = [] } = {}) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dest, { recursive: true })
  for (const name of fs.readdirSync(src)) {
    if (ignore.includes(name)) continue
    const from = path.join(src, name)
    const to = path.join(dest, name)
    const st = fs.statSync(from)
    if (st.isDirectory()) copyDir(from, to, { ignore })
    else copyFile(from, to)
  }
}

function writePackagesManifest({ ver, major, sha, gitZipName, size }) {
  const lines = [
    '# apple-co-work 压缩包（提交在 git 内）',
    '',
    '- **小版本（同大版本）**：覆盖替换 `apple-co-work-v{N}.zip`',
    '- **大版本**：新增 `apple-co-work-v{N+1}.zip`，旧大版本包保留（增量）',
    '',
    `当前版本：\`${ver}\`（大版本 v${major}）`,
    `当前提交：\`${sha}\``,
    `当前包：[\`${gitZipName}\`](./${gitZipName})（${size} bytes）`,
    '',
    '下载（GitHub）：',
    '',
    '```text',
    `https://github.com/371684029/apple-co-work/raw/main/packages/${gitZipName}`,
    '```',
    '',
  ]
  fs.writeFileSync(path.join(PACKAGES_DIR, 'README.md'), lines.join('\n'), 'utf8')
  fs.writeFileSync(
    path.join(PACKAGES_DIR, 'CURRENT.txt'),
    [
      `version=${ver}`,
      `major=${major}`,
      `commit=${sha}`,
      `file=${gitZipName}`,
      `built=${new Date().toISOString()}`,
      `policy=same-major-replace; new-major-keep-old`,
    ].join('\n') + '\n',
    'utf8',
  )
}

function main() {
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
  const folderName = `apple-co-work-${ver}-${sha}`
  const stage = path.join(OUT_ROOT, folderName)
  const gitZipName = `apple-co-work-v${major}.zip`
  const gitZipPath = path.join(PACKAGES_DIR, gitZipName)

  console.log('[pack] build web…')
  sh('npm', ['run', 'build', '-w', 'web'])

  if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true })
  fs.mkdirSync(stage, { recursive: true })

  console.log('[pack] assemble', stage)
  for (const f of [
    'package.json',
    'package-lock.json',
    'README.md',
    'start.mjs',
    'start.bat',
    'start.sh',
    '.gitignore',
  ]) {
    const p = path.join(ROOT, f)
    if (fs.existsSync(p)) copyFile(p, path.join(stage, f))
  }

  copyDir(path.join(ROOT, 'shared'), path.join(stage, 'shared'), {
    ignore: ['node_modules'],
  })
  copyDir(path.join(ROOT, 'server'), path.join(stage, 'server'), {
    ignore: ['node_modules', 'data'],
  })
  // web：只需 package.json + dist（运行靠 server 静态托管）
  // 注意：不要把 packages/ 打进 zip，避免嵌套膨胀
  fs.mkdirSync(path.join(stage, 'web'), { recursive: true })
  copyFile(path.join(ROOT, 'web/package.json'), path.join(stage, 'web/package.json'))
  copyDir(path.join(ROOT, 'web/dist'), path.join(stage, 'web/dist'))
  copyDir(path.join(ROOT, 'web/public'), path.join(stage, 'web/public'), {
    ignore: [],
  })

  copyDir(path.join(ROOT, 'docs'), path.join(stage, 'docs'), {
    ignore: [],
  })
  copyFile(
    path.join(ROOT, 'docs/RELEASE-USER.md'),
    path.join(stage, '使用说明.txt'),
  )

  fs.writeFileSync(
    path.join(stage, 'VERSION.txt'),
    [
      `name=apple-co-work`,
      `version=${ver}`,
      `major=${major}`,
      `commit=${sha}`,
      `built=${new Date().toISOString()}`,
      `autoExit=default-on via start.mjs`,
    ].join('\n') + '\n',
    'utf8',
  )

  fs.mkdirSync(OUT_ROOT, { recursive: true })
  const zipPath = path.join(OUT_ROOT, `${folderName}.zip`)
  const tarPath = path.join(OUT_ROOT, `${folderName}.tar.gz`)

  let artifact = null
  try {
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
    artifact = zipPath
  } catch (e) {
    console.warn('[pack] zip unavailable, fallback tar.gz', e.message)
    execFileSync('tar', ['-czf', tarPath, '-C', OUT_ROOT, folderName], {
      stdio: 'inherit',
    })
    artifact = tarPath
  }

  // 写入 git 跟踪目录：同大版本覆盖；不同大版本并存
  fs.mkdirSync(PACKAGES_DIR, { recursive: true })
  if (artifact.endsWith('.zip')) {
    fs.copyFileSync(artifact, gitZipPath)
  } else {
    // tar.gz 时仍尽量提供 zip 名的副本说明
    const fallback = path.join(PACKAGES_DIR, `apple-co-work-v${major}.tar.gz`)
    fs.copyFileSync(artifact, fallback)
    console.warn('[pack] no zip; wrote', fallback)
  }

  const size = fs.statSync(artifact).size
  const gitSize = fs.existsSync(gitZipPath) ? fs.statSync(gitZipPath).size : size
  writePackagesManifest({
    ver,
    major,
    sha,
    gitZipName,
    size: gitSize,
  })

  console.log('[pack] ok', artifact, `(${size} bytes)`)
  console.log('[pack] git package', gitZipPath, `(replace major v${major})`)
  console.log('[pack] staged dir', stage)

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      [
        `artifact=${artifact}`,
        `artifact_name=${path.basename(artifact)}`,
        `version=${ver}`,
        `major=${major}`,
        `git_zip=packages/${gitZipName}`,
      ].join('\n') + '\n',
    )
  }
  return artifact
}

main()
