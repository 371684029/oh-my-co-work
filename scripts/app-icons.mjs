/**
 * 从首页 Logo（web/public/logo-mark.jpg，与 README / AppLogo 同源）生成
 * Electron 托盘/窗口 PNG 与 Windows ICO。打包与 CI 直接用仓库内产物；
 * 改 Logo 后本机有 ffmpeg 时可重跑：node scripts/app-icons.mjs
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_JPG = path.join(ROOT, 'web/public/logo-mark.jpg')
const SRC_SVG = path.join(ROOT, 'web/src/assets/logo.svg')
const OUT_DIR = path.join(ROOT, 'electron')
const SIZES = [16, 32, 48, 256]

export function pngToIco(pngBuffers) {
  const count = pngBuffers.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)
  const entries = []
  let offset = 6 + 16 * count
  for (const png of pngBuffers) {
    const width = pngWidth(png)
    const entry = Buffer.alloc(16)
    entry[0] = width >= 256 ? 0 : width
    entry[1] = width >= 256 ? 0 : width
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += png.length
    entries.push(entry)
  }
  return Buffer.concat([header, ...entries, ...pngBuffers])
}

function pngWidth(buf) {
  if (buf.length < 24 || buf[0] !== 0x89) return 256
  return buf.readUInt32BE(16)
}

function haveFfmpeg() {
  const r = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' })
  return r.status === 0
}

function ffmpegPng(src, dest, size) {
  const r = spawnSync(
    'ffmpeg',
    ['-y', '-i', src, '-vf', `scale=${size}:${size}:flags=lanczos`, '-frames:v', '1', '-update', '1', dest],
    { stdio: 'inherit' },
  )
  if (r.status !== 0) throw new Error(`ffmpeg 生成 ${dest} 失败`)
}

export function generateAppIcons({ source } = {}) {
  const src = source && fs.existsSync(source) ? source : fs.existsSync(SRC_JPG) ? SRC_JPG : SRC_SVG
  if (!fs.existsSync(src)) throw new Error('找不到 Logo 源文件')
  if (!haveFfmpeg()) {
    throw new Error('需要 ffmpeg 才能从 Logo 重绘图标（打包可直接使用 electron/icon.png）')
  }
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const pngs = []
  for (const size of SIZES) {
    const dest = path.join(OUT_DIR, `icon-${size}.png`)
    ffmpegPng(src, dest, size)
    pngs.push(fs.readFileSync(dest))
  }
  fs.copyFileSync(path.join(OUT_DIR, 'icon-256.png'), path.join(OUT_DIR, 'icon.png'))
  fs.writeFileSync(path.join(OUT_DIR, 'icon.ico'), pngToIco(pngs))
  for (const size of SIZES) {
    if (size === 256) continue
    fs.rmSync(path.join(OUT_DIR, `icon-${size}.png`), { force: true })
  }
  fs.rmSync(path.join(OUT_DIR, 'icon-256.png'), { force: true })
  return {
    png: path.join(OUT_DIR, 'icon.png'),
    ico: path.join(OUT_DIR, 'icon.ico'),
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const out = generateAppIcons()
  console.log('[app-icons]', out.png, out.ico)
}
