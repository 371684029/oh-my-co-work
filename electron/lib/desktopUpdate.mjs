import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { pipeline } from 'node:stream/promises'

const PENDING_NAME = 'pending-update.json'

export function updatesDir(userDataRoot) {
  const d = path.join(userDataRoot, 'updates')
  fs.mkdirSync(d, { recursive: true })
  return d
}

export function pendingPath(userDataRoot) {
  return path.join(updatesDir(userDataRoot), PENDING_NAME)
}

export function readPendingUpdate(userDataRoot) {
  try {
    const p = pendingPath(userDataRoot)
    if (!fs.existsSync(p)) return null
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

function writePending(userDataRoot, data) {
  fs.writeFileSync(pendingPath(userDataRoot), JSON.stringify(data, null, 2), 'utf8')
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256')
  await pipeline(fs.createReadStream(filePath), hash)
  return hash.digest('hex')
}

/**
 * @param {{ url: string, version: string, sha256?: string, userDataRoot: string }} opts
 */
export async function downloadDesktopUpdate(opts) {
  const url = String(opts.url || '').trim()
  const version = String(opts.version || '').trim()
  const userDataRoot = opts.userDataRoot
  if (!url || !version || !userDataRoot) {
    return { ok: false, reason: 'missing-fields' }
  }
  const dest = path.join(updatesDir(userDataRoot), `oh-my-co-work-${version}.zip`)
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) })
  if (!res.ok) return { ok: false, reason: `http-${res.status}` }
  const buf = Buffer.from(await res.arrayBuffer())
  if (!buf.length) return { ok: false, reason: 'empty-body' }
  fs.writeFileSync(dest, buf)
  const stat = fs.statSync(dest)
  if (stat.size < 1024) {
    fs.unlinkSync(dest)
    return { ok: false, reason: 'file-too-small' }
  }
  if (opts.sha256) {
    const got = await sha256File(dest)
    if (got.toLowerCase() !== String(opts.sha256).toLowerCase()) {
      fs.unlinkSync(dest)
      return { ok: false, reason: 'sha256-mismatch' }
    }
  }
  const pending = {
    version,
    url,
    zipPath: dest,
    downloadedAt: new Date().toISOString(),
    applyOnQuit: false,
    bytes: stat.size,
  }
  writePending(userDataRoot, pending)
  return { ok: true, ...pending }
}

export function markApplyOnQuit(userDataRoot, apply = true) {
  const cur = readPendingUpdate(userDataRoot)
  if (!cur?.zipPath || !fs.existsSync(cur.zipPath)) {
    return { ok: false, reason: 'no-pending-download' }
  }
  const next = { ...cur, applyOnQuit: !!apply, applyMarkedAt: new Date().toISOString() }
  writePending(userDataRoot, next)
  return { ok: true, pending: next }
}

/** Apply = stage manual handoff (portable zip); auto-extract over install dir is platform-specific. */
export function consumeApplyOnQuit(userDataRoot, appRoot) {
  const pending = readPendingUpdate(userDataRoot)
  if (!pending?.applyOnQuit || !pending.zipPath) return { applied: false }
  const notePath = path.join(updatesDir(userDataRoot), 'APPLY-README.txt')
  fs.writeFileSync(
    notePath,
    [
      `版本 ${pending.version} 已下载。`,
      `包路径：${pending.zipPath}`,
      `安装目录：${appRoot}`,
      '',
      '请退出应用后解压 zip 覆盖安装目录（保留用户数据目录中的数据库）。',
      '桌面版用户数据通常在系统用户目录下的 oh-my-co-work。',
    ].join('\n'),
    'utf8',
  )
  pending.applyOnQuit = false
  pending.lastApplyNote = notePath
  writePending(userDataRoot, pending)
  return { applied: true, notePath, zipPath: pending.zipPath }
}

export function desktopUpdateResult(manifest, { userDataRoot, appRoot } = {}) {
  if (!manifest || typeof manifest !== 'object') {
    return { ok: false, reason: 'invalid-manifest' }
  }
  const action = String(manifest.action || '').toLowerCase()
  if (action === 'download') {
    if (!userDataRoot) return { ok: false, reason: 'no-user-data' }
    return downloadDesktopUpdate({
      url: manifest.url || manifest.downloadUrl,
      version: manifest.version || manifest.latest,
      sha256: manifest.sha256,
      userDataRoot,
    })
  }
  if (action === 'apply') {
    if (!userDataRoot) return { ok: false, reason: 'no-user-data' }
    return markApplyOnQuit(userDataRoot, manifest.apply !== false)
  }
  if (action === 'status') {
    const pending = userDataRoot ? readPendingUpdate(userDataRoot) : null
    return { ok: true, pending }
  }
  if (action === 'consume-apply') {
    return consumeApplyOnQuit(userDataRoot, appRoot)
  }
  return { ok: false, reason: 'unknown-action' }
}
