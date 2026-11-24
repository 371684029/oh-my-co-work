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
import { buildUnifiedDiff } from './refineDiff.js'

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

function refineConfigAfterRestore(prev) {
  const next = {
    ...(prev && typeof prev === 'object' ? prev : {}),
    enabled: false,
    restoredAt: new Date().toISOString(),
    patchReason: 'restored',
  }
  delete next.verifyFailed
  if (next.verifyLast && typeof next.verifyLast === 'object') {
    next.verifyLast = { ...next.verifyLast, stale: true }
  }
  return next
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
    refine: refineConfigAfterRestore(prev),
  }
  updateMember(memberId, { config: nextConfig })
  return { ok: true, restored, memberId }
}

function safeMemberDir(id) {
  return String(id || 'member').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80)
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
          const diff =
            beforeBuf && currentExists
              ? buildUnifiedDiff(beforeText, currentText, { filePath: f.original })
              : ''
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

/**
 * 某会话关联的炼化改源备份（manifest.sessionId 或 node 所属成员在该会话内）。
 * @param {string} sessionId
 * @param {string[]} [memberIds] 会话节点上的成员 id，用于无 sessionId 的旧 manifest 兜底（跳过）
 */
export function listRefineHistoryForSession(sessionId, memberIds = []) {
  const sid = String(sessionId || '').trim()
  if (!sid) return []
  const ids = [...new Set((memberIds || []).map((x) => String(x || '').trim()).filter(Boolean))]
  const out = []
  for (const mid of ids) {
    for (const h of listMemberSourceHistory(mid)) {
      if (h.kind !== 'refine') continue
      if (h.sessionId !== sid) continue
      if (!h.files?.some((f) => f.diff)) continue
      out.push(h)
    }
  }
  return out.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
}

/** 从 history 条目取出单文件 unified diff，供导出 .patch */
export function refinePatchTextForFile(historyEntry, filePath) {
  const fp = String(filePath || '').trim()
  if (!historyEntry?.files?.length || !fp) return ''
  const hit = historyEntry.files.find(
    (f) => f.path === fp || String(f.path || '').replace(/\\/g, '/') === fp.replace(/\\/g, '/'),
  )
  return hit?.diff ? String(hit.diff) : ''
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
        refine: refineConfigAfterRestore(member.config.refine),
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
