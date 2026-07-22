/**
 * 工作目录占用查询（仅提示，不互斥）。
 * 同一模板 / 同一目录可开多个并行会话；不因路径挡开聊或执行。
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

/** 列出占用某路径的会话（资源面板提示用，不挡操作） */
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
