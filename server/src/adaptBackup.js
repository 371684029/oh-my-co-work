/**
 * 3.1 适配备份：只打包即将改动的源文件，落到 data/backups/adapt。
 * 不扫整盘、不自动 git commit。
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { DATA_ROOT } from './db.js'

export const ADAPT_MARK = 'ACW-ADAPT'
const MAX_FILE_BYTES = 1_500_000
const MAX_TOTAL_BYTES = 8_000_000
const MAX_FILES = 40
const SCRIPT_EXT_RE = /\.(mjs|cjs|js|ts|tsx|jsx|vue|py|ps1|bat|cmd|sh)$/i
const COMMENT_EXT_RE = /\.(mjs|cjs|js|ts|tsx|jsx|vue|py|ps1|bat|cmd|sh|css)$/i

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function safeId(id) {
  return String(id || 'member').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80)
}

function u16(n) {
  const b = Buffer.alloc(2)
  b.writeUInt16LE(n & 0xffff, 0)
  return b
}

function u32(n) {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(n >>> 0, 0)
  return b
}

function guessScriptPath(command) {
  const s = String(command || '').trim()
  if (!s) return ''
  const parts = s.match(/(?:[^\s"'`]+|"[^"]*"|'[^']*')+/g) || []
  for (let i = parts.length - 1; i >= 0; i--) {
    const t = parts[i].replace(/^["']|["']$/g, '').trim()
    if (t && !t.startsWith('-') && SCRIPT_EXT_RE.test(t)) return t
  }
  return ''
}

function resolveMaybe(p, workDir) {
  const s = String(p || '').trim()
  if (!s) return ''
  if (path.isAbsolute(s) || /^[a-zA-Z]:[\\/]/.test(s)) return path.resolve(s)
  if (workDir) return path.resolve(workDir, s)
  return path.resolve(s)
}

export function collectAdaptSourcePaths(member) {
  const script = member?.config?.script || {}
  const work = String(script.scriptWorkDir || script.scriptDir || member?.work_folder || '').trim()
  const raw = []
  const filePath = script.filePath || script.path
  if (filePath) raw.push(filePath)
  const fromCmd = guessScriptPath(script.command)
  if (fromCmd) raw.push(fromCmd)
  const seen = new Set()
  const out = []
  for (const item of raw) {
    const abs = resolveMaybe(item, work)
    if (!abs || seen.has(abs)) continue
    seen.add(abs)
    out.push(abs)
  }
  return out
}

export function isProbablyBinary(buf) {
  if (!buf || !buf.length) return false
  const n = Math.min(buf.length, 8000)
  for (let i = 0; i < n; i++) {
    if (buf[i] === 0) return true
  }
  return false
}

export function assessAdaptFiles(paths) {
  const files = []
  let total = 0
  for (const abs of paths || []) {
    if (files.length >= MAX_FILES) {
      return { ok: false, reason: 'too_many_files', files: [] }
    }
    let st
    try {
      st = fs.statSync(abs)
    } catch {
      continue
    }
    if (!st.isFile()) continue
    if (st.size > MAX_FILE_BYTES) {
      return { ok: false, reason: 'file_too_large', files: [], path: abs }
    }
    total += st.size
    if (total > MAX_TOTAL_BYTES) {
      return { ok: false, reason: 'total_too_large', files: [] }
    }
    let buf
    try {
      buf = fs.readFileSync(abs)
    } catch {
      return { ok: false, reason: 'unreadable', files: [], path: abs }
    }
    if (isProbablyBinary(buf)) {
      return { ok: false, reason: 'binary', files: [], path: abs }
    }
    try {
      fs.accessSync(abs, fs.constants.W_OK)
    } catch {
      return { ok: false, reason: 'read_only', files: [], path: abs }
    }
    files.push({ path: abs, bytes: st.size })
  }
  if (!files.length) return { ok: false, reason: 'no_source', files: [] }
  return { ok: true, reason: 'ok', files }
}

function commentPrefix(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.py' || ext === '.sh' || ext === '.ps1') return '#'
  if (ext === '.bat' || ext === '.cmd') return 'rem'
  if (ext === '.css') return '/*'
  if (ext === '.vue' || ext === '.html') return '<!--'
  return '//'
}

function adaptCommentLine(filePath) {
  const p = commentPrefix(filePath)
  const body =
    '熔炉适配标记。JSONL：ACW_ADAPTER_EVENTS / ACW_ADAPTER_REPLY。可删本行，尽量不影响其它用法。'
  if (p === '/*') return `/* ${ADAPT_MARK}: ${body} */`
  if (p === '<!--') return `<!-- ${ADAPT_MARK}: ${body} -->`
  return `${p} ${ADAPT_MARK}: ${body}`
}

export function applyAdaptComment(filePath) {
  if (!COMMENT_EXT_RE.test(filePath)) {
    return { patched: false, reason: 'not_commentable' }
  }
  const raw = fs.readFileSync(filePath)
  if (isProbablyBinary(raw)) return { patched: false, reason: 'binary' }
  const text = raw.toString('utf8')
  if (text.includes(ADAPT_MARK)) return { patched: false, reason: 'already' }
  const line = adaptCommentLine(filePath)
  let next
  if (text.startsWith('#!')) {
    const nl = text.indexOf('\n')
    if (nl < 0) next = `${text}\n${line}\n`
    else next = `${text.slice(0, nl + 1)}${line}\n${text.slice(nl + 1)}`
  } else {
    next = `${line}\n${text}`
  }
  fs.writeFileSync(filePath, next, 'utf8')
  return { patched: true, reason: 'ok' }
}

export function writeZipArchive(entries, zipPath) {
  const locals = []
  const centrals = []
  let offset = 0
  const now = new Date()
  const dosTime =
    ((now.getHours() & 31) << 11) |
    ((now.getMinutes() & 63) << 5) |
    (Math.floor(now.getSeconds() / 2) & 31)
  const dosDate =
    (((now.getFullYear() - 1980) & 127) << 9) |
    (((now.getMonth() + 1) & 15) << 5) |
    (now.getDate() & 31)

  for (const ent of entries) {
    const name = String(ent.name || path.basename(ent.path)).replace(/\\/g, '/')
    const nameBuf = Buffer.from(name, 'utf8')
    const data = Buffer.isBuffer(ent.data) ? ent.data : fs.readFileSync(ent.path)
    const crc = crc32(data)
    const compressed = zlib.deflateRawSync(data)
    const local =
      Buffer.concat([
        Buffer.from('PK\u0003\u0004', 'binary'),
        u16(20),
        u16(1 << 11),
        u16(8),
        u16(dosTime),
        u16(dosDate),
        u32(crc),
        u32(compressed.length),
        u32(data.length),
        u16(nameBuf.length),
        u16(0),
        nameBuf,
        compressed,
      ])
    const central =
      Buffer.concat([
        Buffer.from('PK\u0001\u0002', 'binary'),
        u16(20),
        u16(20),
        u16(1 << 11),
        u16(8),
        u16(dosTime),
        u16(dosDate),
        u32(crc),
        u32(compressed.length),
        u32(data.length),
        u16(nameBuf.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        nameBuf,
      ])
    locals.push(local)
    centrals.push(central)
    offset += local.length
  }

  const centralBuf = Buffer.concat(centrals)
  const end = Buffer.concat([
    Buffer.from('PK\u0005\u0006', 'binary'),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralBuf.length),
    u32(offset),
    u16(0),
  ])
  fs.mkdirSync(path.dirname(zipPath), { recursive: true })
  fs.writeFileSync(zipPath, Buffer.concat([...locals, centralBuf, end]))
  return zipPath
}

export function createAdaptBackup({ files, memberId, sessionId, nodeId } = {}) {
  const list = (files || []).map((f) => (typeof f === 'string' ? { path: f } : f))
  if (!list.length) throw new Error('没有可备份的适配文件')
  const dir = path.join(DATA_ROOT, 'backups', 'adapt', safeId(memberId))
  fs.mkdirSync(dir, { recursive: true })
  const base = `adapt-${stamp()}`
  const zipPath = path.join(dir, `${base}.zip`)
  const zipEntries = list.map((f, i) => ({
    path: f.path,
    name: `${String(i).padStart(2, '0')}-${path.basename(f.path)}`,
  }))
  writeZipArchive(zipEntries, zipPath)
  const manifest = {
    createdAt: new Date().toISOString(),
    memberId: memberId || null,
    sessionId: sessionId || null,
    nodeId: nodeId || null,
    zip: zipPath,
    files: list.map((f, i) => ({
      original: f.path,
      inZip: zipEntries[i].name,
      bytes: f.bytes || (fs.existsSync(f.path) ? fs.statSync(f.path).size : 0),
    })),
  }
  const manifestPath = path.join(dir, `${base}.json`)
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
  return { zipPath, manifestPath, manifest }
}

function overlayJsonlMember(member) {
  if (!member || member.kind !== 'script') return member
  const script = { ...(member.config?.script || {}) }
  if (script.executionMode === 'pipe') return member
  if (script.adapter === 'jsonl' || script.adapter?.type === 'jsonl') return member
  return {
    ...member,
    config: { ...member.config, script: { ...script, adapter: 'jsonl' } },
  }
}

/**
 * 勾选适配后：能改则先 zip 再打幂等注释并打开 JSONL；不能改只打步骤标记。
 */
export function prepareAdaptForMember(member, { sessionId, nodeId, backup = true } = {}) {
  const paths = collectAdaptSourcePaths(member)
  const assess = assessAdaptFiles(paths)
  if (!assess.ok) {
    return {
      canEdit: false,
      fallback: true,
      enableJsonl: false,
      reason: assess.reason,
      backup: null,
      patched: [],
      member,
    }
  }
  let backupInfo = null
  if (backup !== false) {
    try {
      backupInfo = createAdaptBackup({
        files: assess.files,
        memberId: member.id,
        sessionId,
        nodeId,
      })
    } catch (e) {
      return {
        canEdit: false,
        fallback: true,
        enableJsonl: false,
        reason: 'backup_failed',
        error: e.message,
        backup: null,
        patched: [],
        member,
      }
    }
  }
  const patched = []
  for (const f of assess.files) {
    try {
      const r = applyAdaptComment(f.path)
      if (r.patched) patched.push(f.path)
    } catch (e) {
      return {
        canEdit: false,
        fallback: true,
        enableJsonl: false,
        reason: 'patch_failed',
        error: e.message,
        backup: backupInfo,
        patched,
        member,
      }
    }
  }
  const nextMember = overlayJsonlMember(member)
  return {
    canEdit: true,
    fallback: false,
    enableJsonl: nextMember !== member,
    reason: 'ok',
    backup: backupInfo,
    patched,
    member: nextMember,
  }
}

export function adaptStatusText(prep) {
  if (!prep) return ''
  if (prep.fallback) {
    const why = {
      no_source: '没有可改的源文件',
      read_only: '源文件只读',
      binary: '源文件不是文本',
      file_too_large: '源文件过大',
      total_too_large: '待改文件总体积过大',
      too_many_files: '待改文件过多',
      backup_failed: '备份失败，未改源文件',
      patch_failed: '写入失败，未继续改源文件',
      unreadable: '源文件无法读取',
    }[prep.reason]
    return `适配：${why || prep.reason}，已打步骤标记（不改气泡种类）。`
  }
  const zip = prep.backup?.zipPath ? `备份 ${prep.backup.zipPath}` : '未打备份包'
  const n = (prep.patched || []).length
  return `适配：${zip}；${n ? `已在 ${n} 个源文件写入标记注释` : '源文件已有标记'}；接到工作台 JSONL 侧通道。`
}
