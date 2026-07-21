import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import { DATA_ROOT } from './db.js'
import { uid } from '@acw/shared'

export const UPLOAD_ROOT = path.join(DATA_ROOT, 'uploads')

const MAX_SIZE = 20 * 1024 * 1024 // 20MB
const MAX_FILES = 8

fs.mkdirSync(UPLOAD_ROOT, { recursive: true })

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const sessionId = req.params.id || 'common'
    const dir = path.join(UPLOAD_ROOT, sessionId)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename(_req, file, cb) {
    const safe = String(file.originalname || 'file')
      .replace(/[\\/:*?"<>|]/g, '_')
      .slice(0, 120)
    cb(null, `${Date.now()}_${uid('f').slice(-8)}_${safe}`)
  },
})

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: MAX_SIZE, files: MAX_FILES },
}).array('files', MAX_FILES)

export function filePublicMeta(sessionId, file) {
  const name = file.originalname || file.filename
  const rel = path.posix.join('uploads', sessionId, path.basename(file.filename || file.path))
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

export { MAX_SIZE, MAX_FILES }
