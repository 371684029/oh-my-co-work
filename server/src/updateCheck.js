// 4.2.0 发布更新检查：双源（GitHub Releases API / updateUrl 的 latest.json），
// 3s 超时静默降级。只读远端版本号与更新日志，不上传任何本机数据。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_API = 'https://api.github.com/repos/371684029/oh-my-co-work/releases/latest'
const TIMEOUT_MS = 3000

function readCurrentVersion() {
  try {
    const aboutPath = path.join(__dirname, '..', 'config', 'about.json')
    return String(JSON.parse(fs.readFileSync(aboutPath, 'utf8')).version || '')
  } catch {
    return ''
  }
}

function readUpdateUrl() {
  try {
    const aboutPath = path.join(__dirname, '..', 'config', 'about.json')
    return String(JSON.parse(fs.readFileSync(aboutPath, 'utf8')).updateUrl || '')
  } catch {
    return ''
  }
}

/** semver 主.次.修 数值比较；非法段按 0 处理。a<b → -1 */
export function compareVersions(a, b) {
  const pa = String(a || '')
    .replace(/^v/i, '')
    .split('.')
    .map((n) => Number.parseInt(n, 10) || 0)
  const pb = String(b || '')
    .replace(/^v/i, '')
    .split('.')
    .map((n) => Number.parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0) ? -1 : 1
  }
  return 0
}

export function safeHttpUrl(raw, fallback = '') {
  try {
    const u = new URL(String(raw || ''))
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return fallback
    return u.toString()
  } catch {
    return fallback
  }
}

/** GitHub 目录树页不是 manifest；.json 直链或其它 base 才拼 latest.json */
export function resolveManifestUrl(updateUrl) {
  const base = String(updateUrl || '').trim().replace(/\/$/, '')
  if (!base) return ''
  if (/\.json$/i.test(base)) return base
  if (/github\.com\/[^/]+\/[^/]+\/(?:tree|blob)\//i.test(base)) return ''
  return `${base}/latest.json`
}

function clipNotes(s) {
  const t = String(s || '')
  return t.length > 8000 ? `${t.slice(0, 8000)}\n…` : t
}

async function tryFetchJson(url, fetchImpl) {
  const res = await fetchImpl(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'User-Agent': 'oh-my-co-work-update-check',
      Accept: 'application/vnd.github+json, application/json',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * 检查更新。双源依次尝试，全部失败返回 { checked: false, error }（静默降级，不抛出）。
 * @param {{ fetchImpl?: typeof fetch, currentVersion?: string }} [deps]
 */
export async function checkForUpdates(deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch
  const current = deps.currentVersion != null ? String(deps.currentVersion) : readCurrentVersion()
  const errors = []

  // 源 1：GitHub Releases API（tag_name 取版本，body 为发布说明）
  try {
    const r = await tryFetchJson(REPO_API, fetchImpl)
    const latest = String(r.tag_name || '').replace(/^v/i, '')
    if (latest) {
      return {
        checked: true,
        current,
        latest,
        hasUpdate: compareVersions(latest, current) > 0,
        source: 'github',
        notes: clipNotes(r.body || ''),
        date: String(r.published_at || ''),
        url: safeHttpUrl(r.html_url, 'https://github.com/371684029/oh-my-co-work/releases'),
      }
    }
    errors.push('github: 响应缺少 tag_name')
  } catch (e) {
    errors.push(`github: ${e.message}`)
  }

  // 源 2：updateUrl 指向的静态 latest.json（{ version, notes, date, url }）
  try {
    const manifest = resolveManifestUrl(
      deps.updateUrl != null ? deps.updateUrl : readUpdateUrl(),
    )
    if (manifest) {
      const r = await tryFetchJson(manifest, fetchImpl)
      const latest = String(r.version || '')
      if (latest) {
        return {
          checked: true,
          current,
          latest,
          hasUpdate: compareVersions(latest, current) > 0,
          source: 'manifest',
          notes: clipNotes(r.notes || ''),
          date: String(r.date || ''),
          url: safeHttpUrl(r.url, safeHttpUrl(manifest.replace(/\/latest\.json$/i, ''), manifest)),
        }
      }
      errors.push('manifest: 响应缺少 version')
    } else {
      errors.push('manifest: 未配置可用的 latest.json（已忽略 GitHub 目录页）')
    }
  } catch (e) {
    errors.push(`manifest: ${e.message}`)
  }

  return { checked: false, current, error: errors.join('; ') }
}
