/**
 * R04：工作目录互斥
 * 同一规范化路径上，非归档 / 非 interrupted 会话不可并行占用。
 */
import path from 'node:path'
import { getDb, parseJson } from './db.js'

export function normalizeWorkPath(p) {
  if (p == null || !String(p).trim()) return null
  try {
    let n = path.resolve(String(p).trim())
    if (process.platform === 'win32') n = n.toLowerCase()
    return n
  } catch {
    return String(p).trim()
  }
}

/** 从会话 + 群解析占用路径 */
export function sessionWorkPath(session, group) {
  if (!session) return null
  const ctx = parseJson(session.context_json, {})
  return normalizeWorkPath(
    ctx.primaryWorkFolder ||
      ctx.groupFolder ||
      ctx.params?.['#文件夹'] ||
      ctx.params?.['文件夹'] ||
      group?.work_folder ||
      group?.workFolder ||
      null,
  )
}

/**
 * 若路径被其它进行中会话占用则抛错 PATH_BUSY
 * @returns {string|null} 规范化路径
 */
export function assertPathAvailable(folderPath, excludeSessionId) {
  const norm = normalizeWorkPath(folderPath)
  if (!norm) return null

  const rows = getDb()
    .prepare(
      `SELECT id, title, status, group_id, context_json FROM sessions
       WHERE status NOT IN ('archived', 'failed', 'interrupted')
         AND (? IS NULL OR id != ?)`,
    )
    .all(excludeSessionId || null, excludeSessionId || '')

  for (const s of rows) {
    const group = getDb().prepare('SELECT * FROM groups WHERE id = ?').get(s.group_id)
    const other = sessionWorkPath(s, group)
    if (other && other === norm) {
      throw Object.assign(
        new Error(
          `工作目录已被会话「${s.title || s.id}」占用，请先归档或完成该任务后再开聊`,
        ),
        {
          code: 'PATH_BUSY',
          sessionId: s.id,
          title: s.title,
          path: norm,
        },
      )
    }
  }
  return norm
}

/** 列出占用某路径的会话（调试/API） */
export function listPathHolders(folderPath) {
  const norm = normalizeWorkPath(folderPath)
  if (!norm) return []
  const rows = getDb()
    .prepare(
      `SELECT id, title, status, group_id, context_json FROM sessions
       WHERE status NOT IN ('archived', 'failed')`,
    )
    .all()
  const hit = []
  for (const s of rows) {
    const group = getDb().prepare('SELECT * FROM groups WHERE id = ?').get(s.group_id)
    if (sessionWorkPath(s, group) === norm) {
      hit.push({ id: s.id, title: s.title, status: s.status })
    }
  }
  return hit
}
