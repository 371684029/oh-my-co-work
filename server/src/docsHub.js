// Docs hub (4.0): aggregate per-session journal markdown for browsing.
// Standalone module — NOT part of engine/: reads db + fs directly.
// Security: session-id charset guard + strict filename whitelist (no traversal),
// 1MB read cap, open-path never opens a file directly (dir or containing dir only).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DATA_ROOT, getDb, parseJson } from './db.js'
import { openLocalPath } from './fsBrowser.js'
import { saveSessionAnnouncement } from './engine.js'
import { writeZipArchive } from './adaptBackup.js'

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
function scanAll() {
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
        files: decorateWithNodeMeta(sessionId, files),
      }
      sessions.push(item)
      for (const f of item.files) {
        flat.push({
          sessionId,
          sessionTitle: item.sessionTitle,
          groupTitle: item.groupTitle,
          name: f.name,
          kind: f.kind,
          title: f.title,
          meta: f.meta,
          mtimeMs: f.mtimeMs,
          size: f.size,
        })
      }
    }
    cache = { at: now, data: { sessions, flat } }
  }
  return cache.data
}

/** 节点台账文件补流程轨同源徽标元数据（状态 / 适配 / 克隆） */
function decorateWithNodeMeta(sessionId, files) {
  const steps = files.filter((f) => f.kind === 'step')
  if (!steps.length) return files
  const nodes = getDb()
    .prepare('SELECT id, status, input_json, output_json FROM node_instances WHERE session_id = ?')
    .all(sessionId)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  return files.map((f) => {
    if (f.kind !== 'step') return f
    const n = byId.get(String(f.step != null ? f.name.match(/step-\d+-([A-Za-z0-9_-]+)\.md$/)?.[1] : ''))
    if (!n) return f
    const input = parseJson(n.input_json, {})
    const output = parseJson(n.output_json, {})
    return {
      ...f,
      meta: {
        status: n.status || null,
        adapt: !!(input.adapt || output.adapt),
        cloned: !!(output.cloned || input.cloned),
      },
    }
  })
}

export function listDocs({ sort = 'group' } = {}) {
  const { sessions, flat } = scanAll()
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

const MAX_SEARCH_HITS = 200
const PER_FILE_HITS = 3
const SNIPPET_LEN = 160

/**
 * 全文搜索（内存扫描，不引 FTS）：遍历白名单文档，逐行匹配关键词。
 * @returns {{ q, hits: Array<{ sessionId, sessionTitle, groupTitle, name, kind, title, line, snippet, mtimeMs }> }}
 */
export function searchDocs(q) {
  const needle = String(q || '').trim().toLowerCase()
  if (!needle) return { q: String(q || ''), hits: [] }
  const { sessions } = scanAll()
  const hits = []
  for (const s of sessions) {
    for (const f of s.files) {
      if (hits.length >= MAX_SEARCH_HITS) break
      let content
      try {
        content = readDoc(s.sessionId, f.name).content
      } catch {
        continue
      }
      const lines = content.split(/\r?\n/)
      let inFile = 0
      for (let i = 0; i < lines.length && inFile < PER_FILE_HITS; i++) {
        if (!lines[i].toLowerCase().includes(needle)) continue
        const raw = lines[i].trim()
        const at = raw.toLowerCase().indexOf(needle)
        const from = Math.max(0, Math.floor(at - SNIPPET_LEN / 2))
        const snippet = raw.slice(from, from + SNIPPET_LEN)
        hits.push({
          sessionId: s.sessionId,
          sessionTitle: s.sessionTitle,
          groupTitle: s.groupTitle,
          name: f.name,
          kind: f.kind,
          title: f.title,
          line: i + 1,
          snippet,
          mtimeMs: f.mtimeMs,
        })
        inFile += 1
      }
      if (hits.length >= MAX_SEARCH_HITS) break
    }
  }
  return { q: String(q || ''), hits }
}

function slugify(s) {
  return String(s || 'group').replace(/[\\/:*?"<>|\r\n\s]+/g, '_').slice(0, 60) || 'group'
}

/**
 * 打包一个群模板下全部会话的文档为 zip（文件名前缀为会话标题）。
 * @returns {{ path: string, files: number, sessions: number }} 临时 zip 路径（调用方发送后删除）
 */
export function exportGroupZip(groupId) {
  if (!groupId || !/^[A-Za-z0-9_-]+$/.test(String(groupId))) {
    throw Object.assign(new Error('非法群 ID'), { code: 'BAD_GROUP' })
  }
  const group = getDb().prepare('SELECT id, title FROM groups WHERE id = ?').get(groupId)
  if (!group) throw Object.assign(new Error('群模板不存在'), { code: 'NO_GROUP' })
  const sessions = getDb()
    .prepare('SELECT id, title FROM sessions WHERE group_id = ? ORDER BY updated_at DESC')
    .all(groupId)
  const entries = []
  for (const s of sessions) {
    const files = scanSessionDir(s.id)
    const prefix = `${slugify(s.title)}-${s.id}`
    for (const f of files) {
      entries.push({ name: `${prefix}/${f.name}`, path: path.join(journalRoot(), s.id, ...f.name.split('/')) })
    }
  }
  if (!entries.length) {
    throw Object.assign(new Error('该群没有可导出的文档'), { code: 'EMPTY' })
  }
  const zipPath = path.join(os.tmpdir(), `acw-docs-${groupId}-${Date.now()}.zip`)
  writeZipArchive(entries, zipPath)
  return { path: zipPath, files: entries.length, sessions: sessions.length, groupTitle: group.title }
}
