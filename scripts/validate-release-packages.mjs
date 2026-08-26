#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGES_DIR = path.join(ROOT, 'packages')
const REQUIRED_PLATFORMS = ['darwin-arm64', 'linux-x64', 'win32-x64']

function normalizeEntry(entry) {
  return String(entry || '').replaceAll('\\', '/').replace(/^\.\/+/, '')
}

export function validateArchiveEntries(entries, platform) {
  const normalized = entries.map(normalizeEntry)
  const buildInfoEntries = normalized.filter(
    (entry) => entry === 'BUILD_INFO.json' || entry.endsWith('/BUILD_INFO.json'),
  )
  if (buildInfoEntries.length !== 1) {
    throw new Error(`${platform}: BUILD_INFO.json 数量应为 1，实际 ${buildInfoEntries.length}`)
  }
  if (!normalized.some((entry) => /\/web\/dist\/assets\/spritesheet-[^/]+\.webp$/.test(`/${entry}`))) {
    throw new Error(`${platform}: 缺少 web/dist/assets/spritesheet-*.webp`)
  }
  if (normalized.some((entry) => /\/web\/dist\/assets\/furnace-idle-[^/]+\.(gif|png)$/i.test(`/${entry}`))) {
    throw new Error(`${platform}: 仍包含旧版 furnace-idle GIF/PNG`)
  }
  return buildInfoEntries[0]
}

export function validateBuildMetadataSet({
  metadata,
  expectedCommit,
  expectedVersion,
  requiredPlatforms = REQUIRED_PLATFORMS,
}) {
  const byPlatform = new Map(metadata.map((item) => [item.platform, item]))
  for (const platform of requiredPlatforms) {
    const item = byPlatform.get(platform)
    if (!item) throw new Error(`缺少 ${platform} 构建信息`)
    if (item.kind !== 'runtime-bundle') {
      throw new Error(`${platform}: kind=${item.kind || '空'}，应为 runtime-bundle`)
    }
    if (expectedVersion && item.version !== expectedVersion) {
      throw new Error(`${platform}: version=${item.version}，应为 ${expectedVersion}`)
    }
    if (expectedCommit && item.sourceCommit !== expectedCommit) {
      throw new Error(
        `${platform}: sourceCommit=${item.sourceCommit || '空'}，应为 ${expectedCommit}`,
      )
    }
  }
  const commits = new Set(
    requiredPlatforms.map((platform) => byPlatform.get(platform)?.sourceCommit).filter(Boolean),
  )
  if (commits.size !== 1) {
    throw new Error(`三平台源码提交不一致：${[...commits].join(', ') || '均为空'}`)
  }
  return true
}

function unzipList(zipPath) {
  return execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean)
}

function unzipText(zipPath, entry) {
  return execFileSync('unzip', ['-p', zipPath, entry], { encoding: 'utf8' })
}

function argValue(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : ''
}

export function validateReleasePackages({
  packagesDir = PACKAGES_DIR,
  expectedCommit = '',
} = {}) {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  const version = pkg.version
  const major = String(version).split('.')[0]
  const metadata = []

  for (const platform of REQUIRED_PLATFORMS) {
    const zipName = `oh-my-co-work-v${major}-${platform}.zip`
    const zipPath = path.join(packagesDir, zipName)
    if (!fs.existsSync(zipPath)) throw new Error(`缺少生产包 ${zipName}`)
    const entries = unzipList(zipPath)
    const infoEntry = validateArchiveEntries(entries, platform)
    const info = JSON.parse(unzipText(zipPath, infoEntry))
    if (info.platform !== platform) {
      throw new Error(`${zipName}: BUILD_INFO platform=${info.platform || '空'}`)
    }
    const sidecarPath = path.join(
      packagesDir,
      `oh-my-co-work-v${major}-${platform}.build.json`,
    )
    if (!fs.existsSync(sidecarPath)) throw new Error(`缺少构建旁证 ${path.basename(sidecarPath)}`)
    const sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'))
    if (JSON.stringify(sidecar) !== JSON.stringify(info)) {
      throw new Error(`${platform}: zip 内 BUILD_INFO 与 .build.json 不一致`)
    }
    metadata.push(info)
  }

  validateBuildMetadataSet({
    metadata,
    expectedCommit,
    expectedVersion: version,
  })
  console.log(
    `[release-check] ok version=${version} commit=${metadata[0].sourceCommit} platforms=${REQUIRED_PLATFORMS.join(',')}`,
  )
  return metadata
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try {
    validateReleasePackages({
      expectedCommit: argValue('--expected-sha') || process.env.EXPECTED_SOURCE_SHA || '',
    })
  } catch (error) {
    console.error('[release-check] FAIL', error?.message || error)
    process.exitCode = 1
  }
}
