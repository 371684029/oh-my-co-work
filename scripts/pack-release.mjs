#!/usr/bin/env node
/**
 * 打用户可下载压缩包（不含 node_modules；用户机 npm install / 一键启动会装）
 * 产物：release/apple-co-work-<version>-<shortsha>.zip|.tar.gz
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

function main() {
  const pkg = readJson(path.join(ROOT, 'package.json'))
  const aboutPath = path.join(ROOT, 'server/config/about.json')
  let ver = pkg.version || '0.0.0'
  try {
    ver = readJson(aboutPath).version || ver
  } catch {
    /* ignore */
  }
  const sha = gitShort()
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const folderName = `apple-co-work-${ver}-${sha}`
  const stage = path.join(OUT_ROOT, folderName)

  console.log('[pack] build web…')
  sh('npm', ['run', 'build', '-w', 'web'])

  if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true })
  fs.mkdirSync(stage, { recursive: true })

  console.log('[pack] assemble', stage)
  // 根文件
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
  fs.mkdirSync(path.join(stage, 'web'), { recursive: true })
  copyFile(path.join(ROOT, 'web/package.json'), path.join(stage, 'web/package.json'))
  copyDir(path.join(ROOT, 'web/dist'), path.join(stage, 'web/dist'))
  copyDir(path.join(ROOT, 'web/public'), path.join(stage, 'web/public'), {
    ignore: [],
  })

  copyDir(path.join(ROOT, 'docs'), path.join(stage, 'docs'), {
    ignore: [],
  })
  // 用户向说明置顶
  copyFile(
    path.join(ROOT, 'docs/RELEASE-USER.md'),
    path.join(stage, '使用说明.txt'),
  )

  // 可执行权限提示文件
  fs.writeFileSync(
    path.join(stage, 'VERSION.txt'),
    [
      `name=apple-co-work`,
      `version=${ver}`,
      `commit=${sha}`,
      `built=${new Date().toISOString()}`,
      `autoExit=default-on via start.mjs`,
    ].join('\n') + '\n',
    'utf8',
  )

  fs.mkdirSync(OUT_ROOT, { recursive: true })
  const zipPath = path.join(OUT_ROOT, `${folderName}.zip`)
  const tarPath = path.join(OUT_ROOT, `${folderName}.tar.gz`)

  // 优先 zip，其次 tar.gz
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

  const size = fs.statSync(artifact).size
  console.log('[pack] ok', artifact, `(${size} bytes)`)
  console.log('[pack] staged dir', stage)
  // CI 友好输出
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `artifact=${artifact}\nartifact_name=${path.basename(artifact)}\nversion=${ver}\n`,
    )
  }
  return artifact
}

main()
