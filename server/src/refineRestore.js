import fs from 'node:fs'
import path from 'node:path'
import { getMember, updateMember } from './services.js'
import { restoreAdaptManifest, collectAdaptSourcePaths } from './adaptBackup.js'
import { REFINE_MARK } from './refineSource.js'

function manifestPathForZip(zipPath) {
  const dir = path.dirname(zipPath)
  const base = path.basename(zipPath, '.zip')
  const candidate = path.join(dir, `${base}.json`)
  if (fs.existsSync(candidate)) return candidate
  const alt = zipPath.replace(/\.zip$/i, '.json')
  if (fs.existsSync(alt)) return alt
  return null
}

/** Strip炼化契约块（无备份时的降级，仅移除含 REFINE_MARK 的注释行及紧随的契约行）。 */
export function stripRefineContract(filePath) {
  if (!fs.existsSync(filePath)) return { ok: false, reason: 'missing' }
  const raw = fs.readFileSync(filePath)
  if (raw.includes(0)) return { ok: false, reason: 'binary' }
  const text = raw.toString('utf8')
  if (!text.includes(REFINE_MARK)) return { ok: false, reason: 'no_mark' }
  const nl = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.split(/\r?\n/)
  const out = []
  let skipping = false
  let skipBudget = 0
  for (const line of lines) {
    if (line.includes(REFINE_MARK)) {
      skipping = true
      skipBudget = 8
      continue
    }
    if (skipping && skipBudget > 0) {
      skipBudget -= 1
      if (/^\s*$/.test(line)) skipping = false
      continue
    }
    skipping = false
    out.push(line)
  }
  fs.writeFileSync(filePath, out.join(nl), 'utf8')
  return { ok: true, reason: 'stripped' }
}

export function restoreMemberRefine(memberId, { force = false } = {}) {
  const member = getMember(memberId)
  if (!member) throw Object.assign(new Error('成员不存在'), { code: 'NOT_FOUND' })
  const refine = member.config?.refine
  const zipPath = refine?.refineBackup
  let restored = []
  if (zipPath && fs.existsSync(zipPath)) {
    const manifestPath =
      refine?.refineBackupManifest || manifestPathForZip(zipPath)
    if (!manifestPath) throw Object.assign(new Error('找不到备份 manifest'), { code: 'NO_MANIFEST' })
    const r = restoreAdaptManifest(manifestPath, { force })
    restored = r.restored
  } else {
    for (const p of collectAdaptSourcePaths(member)) {
      const r = stripRefineContract(p)
      if (r.ok) restored.push(p)
    }
    if (!restored.length) {
      throw Object.assign(new Error('没有可还原的炼化备份或契约块'), { code: 'NOTHING_TO_RESTORE' })
    }
  }
  const prev = refine && typeof refine === 'object' ? refine : {}
  const nextConfig = {
    ...(member.config || {}),
    refine: {
      ...prev,
      enabled: false,
      restoredAt: new Date().toISOString(),
      patchReason: 'restored',
    },
  }
  updateMember(memberId, { config: nextConfig })
  return { ok: true, restored, memberId }
}
