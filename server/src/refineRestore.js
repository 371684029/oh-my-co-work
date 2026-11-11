import fs from 'node:fs'
import path from 'node:path'
import { getMember, updateMember } from './services.js'
import { DATA_ROOT } from './db.js'
import {
  readScriptSource,
  restoreAdaptManifest,
  collectAdaptSourcePaths,
  readAdaptZipEntries,
  writeScriptSource,
} from './adaptBackup.js'
import { stripRefineContractText } from './refineContractStrip.js'

function manifestPathForZip(zipPath) {
  const dir = path.dirname(zipPath)
  const base = path.basename(zipPath, '.zip')
  const candidate = path.join(dir, `${base}.json`)
  if (fs.existsSync(candidate)) return candidate
  const alt = zipPath.replace(/\.zip$/i, '.json')
  if (fs.existsSync(alt)) return alt
  return null
}

/** Strip炼化契约块（无备份时的降级；含 acwSyncArgvFromEnv）。 */
export function stripRefineContract(filePath) {
  if (!fs.existsSync(filePath)) return { ok: false, reason: 'missing' }
  const raw = fs.readFileSync(filePath)
  if (raw.includes(0)) return { ok: false, reason: 'binary' }
  const src = readScriptSource(raw)
  if (!src.ok) return { ok: false, reason: src.reason || 'unreadable' }
  const { text, removed } = stripRefineContractText(src.text)
  if (!removed) return { ok: false, reason: 'no_mark' }
  const ext = path.extname(filePath).toLowerCase()
  const hasBom = ext === '.bat' || ext === '.cmd' ? false : src.hasBom
  writeScriptSource(filePath, text, { hasBom })
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

function safeMemberDir(id) {
  return String(id || 'member').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80)
}

function buildLineDiff(beforeText, afterText, maxLines = 160) {
  const a = String(beforeText || '').split(/\r?\n/)
  const b = String(afterText || '').split(/\r?\n/)
  let pre = 0
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++
  let suf = 0
  while (
    suf < a.length - pre &&
    suf < b.length - pre &&
    a[a.length - 1 - suf] === b[b.length - 1 - suf]
  ) {
    suf++
  }
  if (pre === a.length && pre === b.length) return ''
  const ctxStart = Math.max(0, pre - 2)
  const aEnd = a.length - suf
  const bEnd = b.length - suf
  const ctxAfter = Math.min(b.length, bEnd + 2)
  const out = []
  for (let i = ctxStart; i < pre; i++) out.push(`  ${a[i]}`)
  for (let i = pre; i < aEnd && out.length < maxLines; i++) out.push(`- ${a[i]}`)
  for (let i = pre; i < bEnd && out.length < maxLines; i++) out.push(`+ ${b[i]}`)
  for (let i = bEnd; i < ctxAfter && out.length < maxLines; i++) out.push(`  ${b[i]}`)
  return out.join('\n')
}

/**
 * 列出某个成员（或全部成员）在 data/backups/{refine,adapt} 下的源码修改历史，附带前后对比。
 */
export function listMemberSourceHistory(memberId) {
  const out = []
  for (const kind of ['refine', 'adapt']) {
    const dir = path.join(DATA_ROOT, 'backups', kind, safeMemberDir(memberId))
    if (!fs.existsSync(dir)) continue
    const jsons = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse()
    for (const jf of jsons) {
      const manifestPath = path.join(dir, jf)
      try {
        const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
        const zipExists = Boolean(m.zip && fs.existsSync(m.zip))
        const entries = zipExists ? readAdaptZipEntries(m.zip) : new Map()
        const files = (m.files || []).map((f) => {
          const beforeBuf = entries.get(f.inZip)
          const beforeText = beforeBuf ? beforeBuf.toString('utf8') : ''
          const currentExists = Boolean(f.original && fs.existsSync(f.original))
          let currentText = ''
          if (currentExists) {
            try {
              currentText = fs.readFileSync(f.original, 'utf8')
            } catch {
              currentText = ''
            }
          }
          const diff = beforeBuf && currentExists ? buildLineDiff(beforeText, currentText) : ''
          return {
            path: f.original,
            bytes: f.bytes || 0,
            changed: Boolean(diff),
            diff,
          }
        })
        out.push({
          id: `${kind}/${jf.replace(/\.json$/i, '')}`,
          kind,
          createdAt: m.createdAt || null,
          memberId: m.memberId || memberId,
          sessionId: m.sessionId || null,
          nodeId: m.nodeId || null,
          manifestPath,
          zipPath: m.zip || null,
          canRestore: zipExists,
          files,
        })
      } catch {
        /* ignore malformed manifest */
      }
    }
  }
  return out.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
}

/** 按指定 manifest 还原某一次炼化/适配改过的源文件 */
export function restoreSourceByManifest(memberId, manifestId, { force = false } = {}) {
  const member = getMember(memberId)
  if (!member) throw Object.assign(new Error('成员不存在'), { code: 'NOT_FOUND' })
  const list = listMemberSourceHistory(memberId)
  const hit = list.find((x) => x.id === manifestId || x.manifestPath === manifestId)
  if (!hit) throw Object.assign(new Error('找不到对应的备份记录'), { code: 'NOT_FOUND' })
  const r = restoreAdaptManifest(hit.manifestPath, { force })
  if (hit.kind === 'refine' && member.config?.refine) {
    updateMember(memberId, {
      config: {
        ...(member.config || {}),
        refine: {
          ...member.config.refine,
          enabled: false,
          restoredAt: new Date().toISOString(),
          patchReason: 'restored',
        },
      },
    })
  } else if (hit.kind === 'adapt') {
    const prev = member.config && typeof member.config === 'object' ? member.config : {}
    updateMember(memberId, {
      config: {
        ...prev,
        adaptRestoredAt: new Date().toISOString(),
      },
    })
  }
  return { ok: true, restored: r.restored, memberId, manifestId: hit.id, kind: hit.kind }
}

/** 还原成员最近一次适配备份（或指定 manifest） */
export function restoreMemberAdapt(memberId, { force = false, manifestId = '' } = {}) {
  const member = getMember(memberId)
  if (!member) throw Object.assign(new Error('成员不存在'), { code: 'NOT_FOUND' })
  if (manifestId) return restoreSourceByManifest(memberId, manifestId, { force })
  const hist = listMemberSourceHistory(memberId).filter((h) => h.kind === 'adapt')
  if (!hist.length) {
    throw Object.assign(new Error('没有可还原的适配备份'), { code: 'NOT_FOUND' })
  }
  return restoreSourceByManifest(memberId, hist[0].id, { force })
}
