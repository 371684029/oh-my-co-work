/**
 * User data directory resolution & legacy migration (5.3.0 DSK-05).
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { DATA_ROOT, ROOT } from './db.js'
import { nowIso } from '@acw/shared'

const MARKER = '.migrated-from-install-data'

export function defaultUserDataRoot() {
  const home = os.homedir()
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
    return path.join(appData, 'oh-my-co-work')
  }
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'oh-my-co-work')
  }
  const cfg = process.env.XDG_CONFIG_HOME || path.join(home, '.config')
  return path.join(cfg, 'oh-my-co-work')
}

export function legacyInstallDataRoot() {
  return path.join(ROOT, 'data')
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const name of fs.readdirSync(src)) {
    if (name === MARKER) continue
    const from = path.join(src, name)
    const to = path.join(dest, name)
    const st = fs.statSync(from)
    if (st.isDirectory()) copyDirSync(from, to)
    else fs.copyFileSync(from, to)
  }
}

export function getDataDirStatus() {
  const legacy = legacyInstallDataRoot()
  const current = DATA_ROOT
  const recommended = process.env.ACW_DATA_ROOT ? current : defaultUserDataRoot()
  const legacyDb = path.join(legacy, 'oh-my-co-work.sqlite')
  const hasLegacy = fs.existsSync(legacyDb)
  const markerPath = path.join(current, MARKER)
  const migrated = fs.existsSync(markerPath)
  const usingUserDir =
    process.env.ACW_DATA_ROOT != null &&
    path.resolve(process.env.ACW_DATA_ROOT) !== path.resolve(legacy)
  return {
    current,
    legacy,
    recommended,
    hasLegacy,
    migrated,
    usingUserDir,
    envOverride: process.env.ACW_DATA_ROOT || null,
  }
}

export function migrateLegacyDataToCurrent() {
  const status = getDataDirStatus()
  if (!status.hasLegacy) {
    return { ok: false, error: '未发现安装目录下的旧 data/' }
  }
  if (path.resolve(status.current) === path.resolve(status.legacy)) {
    return { ok: false, error: '当前数据目录仍是安装目录，请先用 ACW_DATA_ROOT 指向用户目录' }
  }
  copyDirSync(status.legacy, status.current)
  fs.writeFileSync(
    path.join(status.current, MARKER),
    JSON.stringify({ from: status.legacy, at: nowIso() }, null, 2),
    'utf8',
  )
  return { ok: true, from: status.legacy, to: status.current }
}
