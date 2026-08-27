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
 *   4. 每个原生模块「运行时实际会加载」的那份 .node 魔数都符合目标平台（防交叉打包
 *      混入宿主平台二进制；与 pack-release.mjs 里的 pruneMismatchedNativeBuilds
 *      互为验证）。判断哪份会被加载，严格照抄 node-pty 的 loadNativeModule 顺序：
 *      build/Release → build/Debug → prebuilds/<platform>-<arch>。
 *      交叉打包会把 build/Release|Debug 里宿主平台的错误二进制删掉，这时"实际会
 *      加载"的就变成 prebuilds/<目标平台> 那份——必须查它，不能因为它路径里带
 *      prebuilds 就当成"别的平台的东西，不用管"跳过。
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

// 匹配 .../node_modules/<pkg 或 @scope/pkg>/<build/Release|build/Debug|prebuilds/xxx>/<name>.node
const NATIVE_MODULE_RE =
  /^(.*\/node_modules\/(?:@[^/]+\/)?[^/]+)\/(build\/(?:Release|Debug)|prebuilds\/[^/]+)\/([^/]+\.node)$/

/**
 * 按 node-pty utils.js `loadNativeModule` 的真实优先级（build/Release → build/Debug →
 * prebuilds/<platform>-<arch>），从包内条目里挑出每个原生模块「运行时实际会加载」的那一份。
 * 同一个 <pkg>/<name>.node 可能在 build 和 prebuilds 下都有候选，只有排位最高的那份才会被用到。
 * @param {string[]} entries
 * @param {string} platformTag 例如 win32-x64
 */
export function resolveLoadedNativeEntries(entries, platformTag) {
  const groups = new Map()
  for (const entry of entries) {
    const m = entry.match(NATIVE_MODULE_RE)
    if (!m) continue
    const [, pkgRoot, subpath, basename] = m
    const key = `${pkgRoot}::${basename}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ entry, subpath })
  }
  const loaded = []
  for (const candidates of groups.values()) {
    const pick =
      candidates.find((c) => c.subpath === 'build/Release') ||
      candidates.find((c) => c.subpath === 'build/Debug') ||
      candidates.find((c) => c.subpath === `prebuilds/${platformTag}`)
    // 三个位置都没有目标平台的候选：这个原生模块在目标平台本来就加载不到任何文件，
    // 交给运行时自己报错，这里不重复判断「该不该支持这个平台」。
    if (pick) loaded.push(pick.entry)
  }
  return loaded
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
  const loadedNativeEntries = resolveLoadedNativeEntries(entries, platformTag)
  const mismatched = []
  for (const entry of loadedNativeEntries) {
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
