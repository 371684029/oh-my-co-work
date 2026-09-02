// Docs hub (4.0): aggregate per-session journal markdown for browsing.
// Standalone module — NOT part of engine/: reads db + fs directly.
// Security: session-id charset guard + strict filename whitelist (no traversal),
// 1MB read cap, open-path never opens a file directly (dir or containing dir only).
import fs from 'node:fs'
import path from 'node:path'
import { DATA_ROOT, getDb } from './db.js'
import { openLocalPath } from './fsBrowser.js'
import { saveSessionAnnouncement } from './engine.js'

const MAX_READ_BYTES = 1024 * 1024
const CACHE_TTL_MS = 60_000

const SESSION_ID_RE = /^[A-Za-z0-9_-]+$/
// Whitelist: ANNOUNCEMENT.md / README.md / nodes/step-NN-<nodeId>.md
const FILE_KINDS = [
  { re: /^ANNOUNCEMENT\.md$/, kind: 'announce', title: '群报告' },
  { re: /^README\.md$/, kind: 'index', title: '文档索引' },
  { re: /^nodes\/step-(\d{2})-([A-Za-z0-9_-]+)\.md$/, kind: 'step', title: '节点台账' },
]

function journalRoot() {
  return path.join(DATA_ROOT, 'journals', 'sessions')
}

function classify(name) {
  const normalized = String(name || '').replace(/\\/g, '/')
  for (const rule of FILE_KINDS) {
    const m = normalized.match(rule.re)
    if (m) return { kind: rule.kind, title: rule.title, normalized, step: m[1] ? Number(m[1]) : null }
  }
  return null
}

function statFile(abs) {
  const st = fs.statSync(abs)
  return { mtimeMs: st.mtimeMs, size: st.size }
}

function scanSessionDir(sessionId) {
  const dir = path.join(journalRoot(), sessionId)
  const files = []
  const push = (relName) => {
    const hit = classify(relName)
    if (!hit) return
    const abs = path.join(dir, ...relName.split('/'))
    if (!fs.existsSync(abs)) return
    const st = statFile(abs)
    files.push({ name: hit.normalized, kind: hit.kind, title: hit.title, step: hit.step, ...st })
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile()) push(entry.name)
    else if (entry.isDirectory() && entry.name === 'nodes') {
      for (const sub of fs.readdirSync(path.join(dir, 'nodes'), { withFileTypes: true })) {
        if (sub.isFile()) push(`nodes/${sub.name}`)
      }
    }
  }
  files.sort((a, b) => {
    const rank = { announce: 0, index: 1, step: 2 }
    if (rank[a.kind] !== rank[b.kind]) return rank[a.kind] - rank[b.kind]
    if (a.kind === 'step' && b.kind === 'step') return a.step - b.step
    return a.name.localeCompare(b.name)
  })
  return files
}

function sessionMeta() {
  const db = getDb()
  const sessions = db
    .prepare('SELECT id, title, group_id, status, updated_at, context_json FROM sessions')
    .all()
  const groups = db.prepare('SELECT id, title, config_json FROM groups').all()
  const groupById = new Map(
    groups.map((g) => {
      let adhoc = false
      try {
        adhoc = JSON.parse(g.config_json || '{}')?.adhoc === true
      } catch {
        adhoc = false
      }
      return [g.id, { title: g.title || '', adhoc }]
    }),
  )
  const byId = new Map(
    sessions.map((s) => {
      let workFolder = null
      try {
        const ctx = JSON.parse(s.context_json || '{}')
        workFolder = ctx.groupFolder || ctx.primaryWorkFolder || null
      } catch {
        workFolder = null
      }
      return [s.id, { ...s, workFolder }]
    }),
  )
  return { sessions, groupById, byId }
}

function groupTitleOf(meta, groupId) {
  const g = meta.groupById.get(groupId)
  if (!g) return '未分组'
  return g.adhoc ? '单聊' : g.title || '未命名群'
}

let cache = { at: 0, data: null }

/** Invalidate the scan cache (e.g. after saving an announcement). */
export function invalidateDocsCache() {
  cache = { at: 0, data: null }
}

/**
 * Aggregate docs for all sessions that have a journal dir.
 * @param {{ sort?: 'group'|'time' }} opts
 */
export function listDocs({ sort = 'group' } = {}) {
  const now = Date.now()
  if (!cache.data || now - cache.at > CACHE_TTL_MS) {
    const meta = sessionMeta()
    const root = journalRoot()
    const dirs = fs.existsSync(root)
      ? fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
      : []
    const sessions = []
    const flat = []
    for (const sessionId of dirs) {
      if (!SESSION_ID_RE.test(sessionId)) continue
      const files = scanSessionDir(sessionId)
      if (!files.length) continue
      const s = meta.byId.get(sessionId)
      const group = s ? meta.groupById.get(s.group_id) : null
      const item = {
        sessionId,
        sessionTitle: s?.title || sessionId,
        groupId: s?.group_id || null,
        groupTitle: s ? groupTitleOf(meta, s.group_id) : '未分组',
        adhoc: !!group?.adhoc,
        status: s?.status || null,
        updatedAt: s?.updated_at || null,
        workFolder: s?.workFolder || null,
        files,
      }
      sessions.push(item)
      for (const f of files) {
        flat.push({
          sessionId,
          sessionTitle: item.sessionTitle,
          groupTitle: item.groupTitle,
          name: f.name,
          kind: f.kind,
          title: f.title,
          mtimeMs: f.mtimeMs,
          size: f.size,
        })
      }
    }
    cache = { at: now, data: { sessions, flat } }
  }
  const { sessions, flat } = cache.data
  if (sort === 'time') {
    return { sort, items: [...flat].sort((a, b) => b.mtimeMs - a.mtimeMs) }
  }
  const groups = new Map()
  for (const s of sessions) {
    const key = s.groupId || 'none'
    if (!groups.has(key)) {
      groups.set(key, { groupId: s.groupId, groupTitle: s.groupTitle, adhoc: s.adhoc, sessions: [] })
    }
    groups.get(key).sessions.push(s)
  }
  const groupList = [...groups.values()]
  for (const g of groupList) {
    g.sessions.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
  }
  groupList.sort((a, b) => {
    const latest = (x) => x.sessions[0]?.files?.reduce((m, f) => Math.max(m, f.mtimeMs), 0) || 0
    return latest(b) - latest(a)
  })
  return { sort: 'group', groups: groupList }
}

function assertSession(sessionId) {
  if (!SESSION_ID_RE.test(String(sessionId || ''))) {
    throw Object.assign(new Error('非法会话 ID'), { code: 'BAD_SESSION' })
  }
  const row = getDb().prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId)
  if (!row) throw Object.assign(new Error('会话不存在'), { code: 'NO_SESSION' })
}

/**
 * Read one whitelisted doc file with a 1MB cap.
 * @returns {{ name, kind, size, mtimeMs, content, truncated }}
 */
export function readDoc(sessionId, name) {
  assertSession(sessionId)
  const hit = classify(name)
  if (!hit) throw Object.assign(new Error('文件不在白名单内'), { code: 'NOT_WHITELISTED' })
  const abs = path.join(journalRoot(), sessionId, ...hit.normalized.split('/'))
  if (!fs.existsSync(abs)) throw Object.assign(new Error('文件不存在'), { code: 'NO_FILE' })
  const st = statFile(abs)
  const truncated = st.size > MAX_READ_BYTES
  const content = truncated
    ? fs.readFileSync(abs, { encoding: 'utf8', flag: 'r' }).slice(0, MAX_READ_BYTES)
    : fs.readFileSync(abs, 'utf8')
  return {
    sessionId,
    name: hit.normalized,
    kind: hit.kind,
    size: st.size,
    mtimeMs: st.mtimeMs,
    content,
    truncated,
  }
}

/**
 * Save ANNOUNCEMENT.md through the engine (keeps announcementManual semantics).
 */
export function saveAnnouncement(sessionId, markdown) {
  assertSession(sessionId)
  const out = saveSessionAnnouncement(sessionId, String(markdown ?? ''))
  invalidateDocsCache()
  return out
}

/**
 * Open a local path from a rendered doc link.
 * Directories open as-is; files NEVER open directly — their containing dir opens instead.
 * @param {{ openTarget?: (p: string) => Promise<unknown> }} [deps]
 */
export async function openDocsPath(targetPath, deps = {}) {
  const openTarget = deps.openTarget || openLocalPath
  const raw = String(targetPath || '').trim()
  if (!raw) throw Object.assign(new Error('路径为空'), { code: 'BAD_PATH' })
  const abs = path.resolve(raw)
  if (!fs.existsSync(abs)) throw Object.assign(new Error('路径不存在'), { code: 'NO_PATH' })
  const st = fs.statSync(abs)
  const opened = st.isDirectory() ? abs : path.dirname(abs)
  await openTarget(opened)
  return { ok: true, opened, isDir: st.isDirectory() }
}
