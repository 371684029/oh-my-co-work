import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import { DATA_ROOT } from './db.js'
import { uid, buildFurnacePtyAttachText } from '@acw/shared'

export const UPLOAD_ROOT = path.join(DATA_ROOT, 'uploads')

const MAX_SIZE = 20 * 1024 * 1024 // 20MB
const MAX_FILES = 8

fs.mkdirSync(UPLOAD_ROOT, { recursive: true })

export function safeUploadBasename(originalname) {
  return String(originalname || 'file')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\.\./g, '_')
    .slice(0, 120) || 'file'
}

export function safeSessionFolder(sessionId) {
  const id = String(sessionId || 'common')
    .replace(/\.\./g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
  return id.slice(0, 80) || 'common'
}

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const sessionId = req.params.id || 'common'
    const dir = path.join(UPLOAD_ROOT, sessionId)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename(_req, file, cb) {
    cb(null, `${Date.now()}_${uid('f').slice(-8)}_${safeUploadBasename(file.originalname)}`)
  },
})

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: MAX_SIZE, files: MAX_FILES },
}).array('files', MAX_FILES)

export function filePublicMeta(sessionId, file) {
  const name = file.originalname || file.filename
  return {
    id: uid('att'),
    name,
    size: file.size,
    mime: file.mimetype || 'application/octet-stream',
    url: `/api/files/${sessionId}/${encodeURIComponent(path.basename(file.filename))}`,
    storedName: path.basename(file.filename),
  }
}

export function resolveStoredFile(sessionId, storedName) {
  const base = path.join(UPLOAD_ROOT, sessionId)
  const full = path.join(base, path.basename(storedName))
  if (!full.startsWith(base)) return null
  if (!fs.existsSync(full)) return null
  return full
}

/** 熔炉 cwd 下的 inbox，Grok 进程能直接按相对路径打开 */
const FURNACE_INBOX_EXT =
  /\.(png|jpe?g|gif|webp|svg|pdf|txt|md|csv|json|xml|ya?ml|toml|html|css|js|mjs|cjs|ts|tsx|vue|py|go|rs|java|kt|zip|docx?|xlsx?|pptx?)$/i
const FURNACE_INBOX_BLOCK_EXT = /\.(exe|dll|com|msi|scr|bat|cmd|ps1)$/i

export function furnaceInboxAllowed(file = {}) {
  const name = String(file.originalname || file.filename || file.name || '')
  const mime = String(file.mimetype || file.mime || '').toLowerCase()
  if (FURNACE_INBOX_BLOCK_EXT.test(name)) return false
  if (mime.startsWith('image/')) return true
  if (mime.startsWith('text/')) return true
  if (
    mime === 'application/pdf' ||
    mime === 'application/json' ||
    mime === 'application/xml' ||
    mime === 'application/zip' ||
    mime.startsWith('application/vnd.openxmlformats-officedocument.')
  ) {
    return true
  }
  return FURNACE_INBOX_EXT.test(name)
}

export function furnaceInboxDir(sessionId) {
  const dir = path.join(DATA_ROOT, 'furnace', 'inbox', safeSessionFolder(sessionId))
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function clearFurnaceInbox(sessionId) {
  const dir = path.join(DATA_ROOT, 'furnace', 'inbox', safeSessionFolder(sessionId))
  const root = path.join(DATA_ROOT, 'furnace', 'inbox')
  if (!dir.startsWith(root) || !fs.existsSync(dir)) return { removed: 0 }
  let removed = 0
  for (const name of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, name), { force: true })
    removed += 1
  }
  try {
    fs.rmdirSync(dir)
  } catch {
    /* not empty */
  }
  return { removed }
}

const furnaceStorage = multer.diskStorage({
  destination(req, _file, cb) {
    try {
      cb(null, furnaceInboxDir(req.params.id))
    } catch (e) {
      cb(e)
    }
  },
  filename(_req, file, cb) {
    cb(null, `${Date.now()}_${uid('f').slice(-8)}_${safeUploadBasename(file.originalname)}`)
  },
})

export const furnaceUploadMiddleware = multer({
  storage: furnaceStorage,
  limits: { fileSize: MAX_SIZE, files: MAX_FILES },
  fileFilter(_req, file, cb) {
    if (furnaceInboxAllowed(file)) return cb(null, true)
    cb(new Error('熔炉附件仅支持图片、文档和常见源码'))
  },
}).array('files', MAX_FILES)

export function furnaceFileMeta(sessionId, file) {
  const storedName = path.basename(file.filename || file.path || '')
  const relPath = path.posix.join('inbox', safeSessionFolder(sessionId), storedName)
  const absPath = path.join(furnaceInboxDir(sessionId), storedName)
  return {
    id: uid('att'),
    name: file.originalname || storedName,
    size: file.size,
    mime: file.mimetype || 'application/octet-stream',
    storedName,
    relPath,
    absPath,
  }
}

export function furnaceFilePublicMeta(sessionId, file) {
  const { absPath: _abs, ...pub } = furnaceFileMeta(sessionId, file)
  return pub
}

export function writeFurnaceInboxFile(sessionId, originalName, buffer, mime = 'application/octet-stream') {
  if (!furnaceInboxAllowed({ originalname: originalName, mimetype: mime })) {
    throw new Error('熔炉附件仅支持图片、文档和常见源码')
  }
  const dir = furnaceInboxDir(sessionId)
  const storedName = `${Date.now()}_${uid('f').slice(-8)}_${safeUploadBasename(originalName)}`
  const absPath = path.join(dir, storedName)
  fs.writeFileSync(absPath, buffer)
  return furnaceFileMeta(sessionId, {
    originalname: originalName,
    filename: storedName,
    size: Buffer.byteLength(buffer),
    mimetype: mime,
    path: absPath,
  })
}

export { MAX_SIZE, MAX_FILES, buildFurnacePtyAttachText }
