#!/usr/bin/env node
/**
 * 单个刚打好的运行包 zip 的「打包即验」检查。
 *
 * 目的：在 CI 把这份 zip 提交进 git 之前拦下坏包，而不是等三平台 release 门禁
 * 才发现——那时坏包已经进了 packages/。检查项：
 *   1. BUILD_INFO.json 存在、platform/version/kind 与预期一致
 *   2. web/dist/assets/spritesheet-*.webp 存在，且与本仓库当前源素材字节一致
 *      （不是硬编码某个哈希——图集以后换代，这条检查依然有效）
 *   3. 不含已退役的 furnace-idle GIF/PNG
 *   4. 包内每个 .node 原生模块的魔数都符合目标平台（防交叉打包混入宿主平台二进制；
 *      与 pack-release.mjs 里的 pruneMismatchedNativeBuilds 互为验证）
 *
 * 用法：node scripts/verify-pack.mjs --zip packages/xxx.zip --platform win32-x64
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_SPRITESHEET = path.join(ROOT, 'web/src/assets/pets/li-muwan/spritesheet.webp')

const NATIVE_MAGIC_CHECK = {
  linux: (buf) =>
    buf.length >= 4 && buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46,
  win32: (buf) => buf.length >= 2 && buf[0] === 0x4d && buf[1] === 0x5a,
  darwin: (buf) => {
    if (buf.length < 4) return false
    const magic = buf.readUInt32BE(0)
    return [0xfeedface, 0xcefaedfe, 0xfeedfacf, 0xcffaedfe, 0xcafebabe, 0xbebafeca].includes(
      magic,
    )
  },
}

function normalizeEntry(entry) {
  return String(entry || '').replaceAll('\\', '/').replace(/^\.\/+/, '')
}

function unzipList(zipPath) {
  return execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean)
}

function unzipBytes(zipPath, entry) {
  return execFileSync('unzip', ['-p', zipPath, entry], { maxBuffer: 1024 * 1024 * 64 })
}

function platformOf(tag) {
  const m = String(tag).match(/^(win32|linux|darwin)-(x64|arm64)$/)
  if (!m) throw new Error(`未知平台标签: ${tag}`)
  return m[1]
}

export function verifyPackedZip({ zipPath, platformTag, expectedVersion }) {
  if (!fs.existsSync(zipPath)) throw new Error(`找不到 zip: ${zipPath}`)
  const platform = platformOf(platformTag)
  const entries = unzipList(zipPath).map(normalizeEntry)

  const buildInfoEntries = entries.filter(
    (e) => e === 'BUILD_INFO.json' || e.endsWith('/BUILD_INFO.json'),
  )
  if (buildInfoEntries.length !== 1) {
    throw new Error(`BUILD_INFO.json 数量应为 1，实际 ${buildInfoEntries.length}`)
  }
  const info = JSON.parse(unzipBytes(zipPath, buildInfoEntries[0]).toString('utf8'))
  if (info.platform !== platformTag) {
    throw new Error(`BUILD_INFO platform=${info.platform || '空'}，应为 ${platformTag}`)
  }
  if (info.kind !== 'runtime-bundle') {
    throw new Error(`BUILD_INFO kind=${info.kind || '空'}，应为 runtime-bundle`)
  }
  if (expectedVersion && info.version !== expectedVersion) {
    throw new Error(`BUILD_INFO version=${info.version}，应为 ${expectedVersion}`)
  }

  const spriteEntries = entries.filter((e) => /\/web\/dist\/assets\/spritesheet-[^/]+\.webp$/.test(`/${e}`))
  if (spriteEntries.length !== 1) {
    throw new Error(`web/dist/assets/spritesheet-*.webp 数量应为 1，实际 ${spriteEntries.length}`)
  }
  if (fs.existsSync(SOURCE_SPRITESHEET)) {
    const packed = unzipBytes(zipPath, spriteEntries[0])
    const source = fs.readFileSync(SOURCE_SPRITESHEET)
    if (!packed.equals(source)) {
      throw new Error('打包内的图集字节与源码 web/src/assets/pets/li-muwan/spritesheet.webp 不一致（可能用了旧 dist 缓存）')
    }
  }

  if (entries.some((e) => /\/web\/dist\/assets\/furnace-idle-[^/]+\.(gif|png)$/i.test(`/${e}`))) {
    throw new Error('仍包含已退役的旧版 furnace-idle GIF/PNG')
  }

  const nativeCheck = NATIVE_MAGIC_CHECK[platform]
  const nativeEntries = entries.filter((e) => e.endsWith('.node'))
  const mismatched = []
  for (const entry of nativeEntries) {
    // build/Release、build/Debug 是运行时优先加载的路径；prebuilds/<其它平台>/ 只是
    // node-pty 自带的多平台预编译，本来就不该、也不会在目标平台被加载，跳过不查。
    if (!/\/(build\/(Release|Debug))\//.test(`/${entry}`)) continue
    const bytes = unzipBytes(zipPath, entry)
    if (!nativeCheck(bytes.subarray(0, 4))) {
      mismatched.push(entry)
    }
  }
  if (mismatched.length) {
    throw new Error(
      `以下原生模块架构与目标平台 ${platformTag} 不符，交叉打包混入了宿主平台二进制: ${mismatched.join(', ')}`,
    )
  }

  console.log(`[verify-pack] ok ${path.basename(zipPath)} platform=${platformTag} version=${info.version}`)
  return info
}

function argValue(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : ''
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try {
    verifyPackedZip({
      zipPath: argValue('--zip'),
      platformTag: argValue('--platform'),
      expectedVersion: argValue('--version') || '',
    })
  } catch (error) {
    console.error('[verify-pack] FAIL', error?.message || error)
    process.exitCode = 1
  }
}
