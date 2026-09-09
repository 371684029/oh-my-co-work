// Docs hub (4.0): aggregate per-session journal markdown for browsing.
// Standalone module — NOT part of engine/: reads db + fs directly.
// Security: session-id charset guard + strict filename whitelist (no traversal),
// 1MB read cap, open-path never opens a file directly (dir or containing dir only).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { StringDecoder } from 'node:string_decoder'
import { DATA_ROOT, getDb, parseJson } from './db.js'
import { openLocalPath } from './fsBrowser.js'
import { saveSessionAnnouncement } from './engine.js'
import { writeZipArchive } from './adaptBackup.js'
import { fuzzyScore, searchMatchThreshold } from '@acw/shared'

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

function confinedUnder(root, candidate) {
  const r = path.resolve(root)
  const c = path.resolve(candidate)
  return c === r || c.startsWith(r + path.sep)
}

function resolveWhitelistedAbs(sessionId, relName) {
  const root = path.resolve(journalRoot(), sessionId)
  const abs = path.resolve(root, ...String(relName).split('/'))
  if (!confinedUnder(root, abs)) {
    throw Object.assign(new Error('路径越界'), { code: 'ESCAPE' })
  }
  if (!fs.existsSync(abs)) throw Object.assign(new Error('文件不存在'), { code: 'NO_FILE' })
  const st = fs.lstatSync(abs)
  if (st.isSymbolicLink()) {
    throw Object.assign(new Error('不读取符号链接'), { code: 'SYMLINK' })
  }
  const realRoot = fs.realpathSync(root)
  const realFile = fs.realpathSync(abs)
  if (!confinedUnder(realRoot, realFile)) {
    throw Object.assign(new Error('路径越界'), { code: 'ESCAPE' })
  }
  if (!fs.statSync(realFile).isFile()) {
    throw Object.assign(new Error('不是普通文件'), { code: 'BAD_FILE' })
  }
  return realFile
}

function classify(name) {
  let normalized = String(name || '').replace(/\\/g, '/')
  // 计划/互链示例写 ./step-01-x.md，真实文件在 nodes/step-NN-*.md
  if (/^step-\d{2}-[A-Za-z0-9_-]+\.md$/.test(normalized)) {
    normalized = `nodes/${normalized}`
  }
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
  const seen = new Set()
  const push = (relName) => {
    const hit = classify(relName)
    if (!hit) return
    const abs = path.join(dir, ...relName.split('/'))
    if (!fs.existsSync(abs)) return
    try {
      if (fs.lstatSync(abs).isSymbolicLink()) return
    } catch {
      return
    }
    // 根目录误命名的 step-*.md 会被 classify 归一为 nodes/step-*.md，与 nodes 下真实文件指向同一绝对路径，去重避免重复条目。
    if (seen.has(abs)) return
    seen.add(abs)
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
      if (!s) continue
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
  const abs = resolveWhitelistedAbs(sessionId, hit.normalized)
  const st = statFile(abs)
  const truncated = st.size > MAX_READ_BYTES
  const n = truncated ? MAX_READ_BYTES : st.size
  const buf = Buffer.alloc(n)
  const fd = fs.openSync(abs, 'r')
  let bytesRead = 0
  try {
    // 循环读取：POSIX 允许单次 read 短读，读满 n 避免尾部残留 NUL。
    while (bytesRead < n) {
      const r = fs.readSync(fd, buf, bytesRead, n - bytesRead, bytesRead)
      if (r <= 0) break
      bytesRead += r
    }
  } finally {
    fs.closeSync(fd)
  }
  // StringDecoder 缓冲尾部不完整的多字节序列（不输出 U+FFFD），正文末尾被切断的半个字符被安全丢弃，
  // 从而在 1MB 字节上限内避免产生替换字符。
  const content = new StringDecoder('utf8').write(buf.subarray(0, bytesRead))
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
function allowedOpenPrefixes() {
  const prefixes = [path.resolve(DATA_ROOT)]
  try {
    prefixes.push(path.resolve(os.homedir()))
  } catch {
    /* ignore */
  }
  try {
    prefixes.push(path.resolve(process.cwd()))
  } catch {
    /* ignore */
  }
  try {
    const rows = getDb().prepare('SELECT context_json FROM sessions').all()
    for (const r of rows) {
      const ctx = parseJson(r.context_json, {})
      const wf = ctx.groupFolder || ctx.primaryWorkFolder
      if (wf) prefixes.push(path.resolve(String(wf)))
    }
  } catch {
    /* ignore */
  }
  return prefixes
}

export async function openDocsPath(targetPath, deps = {}) {
  const openTarget = deps.openTarget || openLocalPath
  const raw = String(targetPath || '').trim()
  if (!raw) throw Object.assign(new Error('路径为空'), { code: 'BAD_PATH' })
  const abs = path.resolve(raw)
  if (!fs.existsSync(abs)) throw Object.assign(new Error('路径不存在'), { code: 'NO_PATH' })
  const st = fs.statSync(abs)
  const opened = st.isDirectory() ? abs : path.dirname(abs)
  const openedReal = fs.realpathSync(opened)
  const ok = allowedOpenPrefixes().some((p) => {
    try {
      const rp = fs.existsSync(p) ? fs.realpathSync(p) : path.resolve(p)
      return confinedUnder(rp, openedReal)
    } catch {
      return confinedUnder(p, openedReal)
    }
  })
  if (!ok) {
    throw Object.assign(new Error('路径不在允许打开的范围内'), { code: 'NOT_ALLOWED' })
  }
  await openTarget(openedReal)
  return { ok: true, opened: openedReal, isDir: st.isDirectory() }
}

const MAX_SEARCH_HITS = 200
const PER_FILE_HITS = 3
const SNIPPET_LEN = 160
const MAX_SEARCH_FILES = 400

function snippetAround(raw, needle) {
  const lower = raw.toLowerCase()
  let at = lower.indexOf(needle)
  if (at < 0) at = 0
  const from = Math.max(0, Math.floor(at - SNIPPET_LEN / 2))
  return raw.slice(from, from + SNIPPET_LEN)
}

export function searchDocs(q) {
  const threshold = searchMatchThreshold(q)
  const needle = String(q || '').trim().toLowerCase()
  if (threshold == null) return { q: String(q || ''), hits: [] }
  const { sessions } = scanAll()
  const hits = []
  let filesScanned = 0
  for (const s of sessions) {
    const titleScore = Math.max(
      fuzzyScore(needle, s.sessionTitle),
      fuzzyScore(needle, s.groupTitle),
    )
    if (titleScore >= threshold) {
      hits.push({
        sessionId: s.sessionId,
        sessionTitle: s.sessionTitle,
        groupTitle: s.groupTitle,
        name: 'README.md',
        kind: 'index',
        title: `会话「${s.sessionTitle}」`,
        line: 0,
        snippet: `群：${s.groupTitle || ''} 会话：${s.sessionTitle}`,
        mtimeMs: s.files.reduce((m, f) => Math.max(m, f.mtimeMs), 0) || 0,
        score: titleScore,
      })
    }
    for (const f of s.files) {
      if (filesScanned >= MAX_SEARCH_FILES) break
      filesScanned += 1
      let content
      try {
        content = readDoc(s.sessionId, f.name).content
      } catch {
        continue
      }
      const lines = content.split(/\r?\n/)
      let inFile = 0
      for (let i = 0; i < lines.length && inFile < PER_FILE_HITS; i++) {
        const score = fuzzyScore(needle, lines[i])
        if (score < threshold) continue
        hits.push({
          sessionId: s.sessionId,
          sessionTitle: s.sessionTitle,
          groupTitle: s.groupTitle,
          name: f.name,
          kind: f.kind,
          title: f.title,
          line: i + 1,
          snippet: snippetAround(lines[i].trim(), needle),
          mtimeMs: f.mtimeMs,
          score,
        })
        inFile += 1
      }
    }
  }
  hits.sort((a, b) => (b.score || 0) - (a.score || 0) || (b.mtimeMs || 0) - (a.mtimeMs || 0))
  return { q: String(q || ''), hits: hits.slice(0, MAX_SEARCH_HITS) }
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
  const slug = slugify(group.title)
  return {
    path: zipPath,
    files: entries.length,
    sessions: sessions.length,
    groupTitle: group.title,
    slug,
    filename: `${slug}.zip`,
  }
}

/**
 * 打包全系统所有会话的文档为 zip，按群模板与会话分目录。
 * @returns {{ path: string, files: number, sessions: number, filename: string }}
 */
export function exportAllDocsZip() {
  const groups = getDb().prepare('SELECT id, title FROM groups').all()
  const groupMap = new Map(groups.map((g) => [g.id, g.title]))
  const sessions = getDb()
    .prepare('SELECT id, title, group_id FROM sessions ORDER BY updated_at DESC')
    .all()

  const entries = []
  for (const s of sessions) {
    const files = scanSessionDir(s.id)
    const gTitle = s.group_id ? (groupMap.get(s.group_id) || '未命名群') : '独立会话'
    const groupPrefix = slugify(gTitle)
    const sessionPrefix = `${slugify(s.title)}-${s.id}`
    for (const f of files) {
      entries.push({
        name: `${groupPrefix}/${sessionPrefix}/${f.name}`,
        path: path.join(journalRoot(), s.id, ...f.name.split('/')),
      })
    }
  }

  if (!entries.length) {
    const readmeBuf = Buffer.from('# oh-my-co-work 协同文档中心\n\n暂无会话文档。\n', 'utf8')
    entries.push({
      name: 'README.md',
      data: readmeBuf,
    })
  }

  const zipPath = path.join(os.tmpdir(), `acw-docs-all-${Date.now()}.zip`)
  writeZipArchive(entries, zipPath)
  const filename = `oh-my-co-work-all-docs-${Date.now()}.zip`
  return {
    path: zipPath,
    files: entries.length,
    sessions: sessions.length,
    filename,
  }
}

