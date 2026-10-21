/**
 * Local diagnostics bundle (5.3.0 ENG-05 / 5.1.0 OBS-01).
 */
import fs from 'node:fs'
import path from 'node:path'
import { DATA_ROOT, ROOT } from './db.js'
import { getAppSettings } from './appSettings.js'
import { getLifecycleStatus } from './lifecycle.js'

const LOG_TAIL_BYTES = 24_000

function tailFile(filePath, maxBytes = LOG_TAIL_BYTES) {
  try {
    if (!fs.existsSync(filePath)) return null
    const stat = fs.statSync(filePath)
    const start = Math.max(0, stat.size - maxBytes)
    const fd = fs.openSync(filePath, 'r')
    try {
      const buf = Buffer.alloc(stat.size - start)
      fs.readSync(fd, buf, 0, buf.length, start)
      return buf.toString('utf8')
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    return null
  }
}

function redactSettings(settings) {
  const s = settings && typeof settings === 'object' ? { ...settings } : {}
  if (s.grok?.apiKey) s.grok = { ...s.grok, apiKey: '[redacted]' }
  return s
}

export function collectDiagnostics() {
  const aboutPath = path.join(ROOT, 'server/config/about.json')
  let about = {}
  try {
    about = JSON.parse(fs.readFileSync(aboutPath, 'utf8'))
  } catch {
    /* ignore */
  }
  const electronLog = path.join(DATA_ROOT, 'logs', 'electron.log')
  const serverLog = path.join(DATA_ROOT, 'logs', 'desktop-server.log')
  return {
    collectedAt: new Date().toISOString(),
    product: about.productName || 'oh-my-co-work',
    version: about.version || process.env.npm_package_version || 'unknown',
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    dataRoot: DATA_ROOT,
    lifecycle: getLifecycleStatus(),
    settings: redactSettings(getAppSettings()),
    logs: {
      electron: tailFile(electronLog),
      server: tailFile(serverLog),
    },
  }
}
