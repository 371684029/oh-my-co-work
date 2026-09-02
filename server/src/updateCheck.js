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
        notes: String(r.body || ''),
        date: String(r.published_at || ''),
        url: String(r.html_url || REPO_API),
      }
    }
    errors.push('github: 响应缺少 tag_name')
  } catch (e) {
    errors.push(`github: ${e.message}`)
  }

  // 源 2：updateUrl 指向的静态 latest.json（{ version, notes, date, url }）
  try {
    const base = readUpdateUrl().replace(/\/$/, '')
    if (base) {
      const r = await tryFetchJson(`${base}/latest.json`, fetchImpl)
      const latest = String(r.version || '')
      if (latest) {
        return {
          checked: true,
          current,
          latest,
          hasUpdate: compareVersions(latest, current) > 0,
          source: 'manifest',
          notes: String(r.notes || ''),
          date: String(r.date || ''),
          url: String(r.url || base),
        }
      }
      errors.push('manifest: 响应缺少 version')
    } else {
      errors.push('manifest: 未配置 updateUrl')
    }
  } catch (e) {
    errors.push(`manifest: ${e.message}`)
  }

  return { checked: false, current, error: errors.join('; ') }
}
