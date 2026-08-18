/**
 * 从当前会话抽出熔炉情境包（槽位填充，不调模型）。
 */
import { getDb, parseJson } from './db.js'
import { FURNACE_ROLE } from '@acw/shared'
import {
  activateFurnaceRole,
  currentFurnaceRole,
} from './furnaceContext.js'

function getMember(id) {
  if (!id) return null
  return getDb().prepare('SELECT * FROM members WHERE id = ?').get(id)
}

export function collectFurnaceSituationFacts(sessionId, { nodeId } = {}) {
  const session = getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId)
  if (!session) return null
  const group = session.group_id
    ? getDb().prepare('SELECT * FROM groups WHERE id = ?').get(session.group_id)
    : null
  const ctx = parseJson(session.context_json, {})
  const steps = parseJson(group?.steps_json, [])
  const nodes = getDb()
    .prepare(
      `SELECT * FROM node_instances WHERE session_id = ? ORDER BY step_index`,
    )
    .all(sessionId)

  let nowNode = null
  if (nodeId) nowNode = nodes.find((n) => n.id === nodeId) || null
  if (!nowNode) {
    const idx = Number(session.current_step_index)
    nowNode =
      nodes.find((n) => n.step_index === idx) ||
      nodes.find((n) => n.status && n.status !== 'pending') ||
      nodes[0] ||
      null
  }

  const notes = Array.isArray(ctx.userNotes) ? ctx.userNotes : []
  const latestNote = notes.length ? String(notes[notes.length - 1].text || '').trim() : ''
  const kickoff = ctx.kickoff && typeof ctx.kickoff === 'object' ? String(ctx.kickoff.text || '').trim() : ''
  const intent = kickoff || latestNote || ''

  const skipParam = new Set(['#群聊', '群聊', '#文件夹', '文件夹'])
  const params = []
  const list = Array.isArray(ctx.paramsList) ? ctx.paramsList : []
  for (const item of list) {
    const key = item?.key || item?.name
    if (!key || skipParam.has(key)) continue
    params.push({ key, value: item?.value })
  }
  if (!params.length && ctx.params && typeof ctx.params === 'object') {
    for (const [key, value] of Object.entries(ctx.params)) {
      if (skipParam.has(key) || key === '#群聊' || key === '#文件夹') continue
      if (String(key).startsWith('#') || key === '#a' || key === 'a') {
        params.push({ key: String(key).startsWith('#') ? key : `#${key}`, value })
      }
    }
  }

  const agenda = steps.map((s, i) => {
    const member = s.memberId ? getMember(s.memberId) : null
    const who = member?.display_name || member?.name || ''
    const title = s.title || `步骤 ${i + 1}`
    return { title: who ? `${title} · ${who}` : title }
  })

  const nowIndex =
    nowNode && Number.isFinite(Number(nowNode.step_index))
      ? Number(nowNode.step_index)
      : Number(session.current_step_index) || 0

  return {
    intent,
    sessionId,
    sessionTitle: session.title || '',
    groupTitle: group?.title || '',
    groupDescription: group?.description || '',
    workFolder: ctx.groupFolder || group?.work_folder || '',
    agenda,
    nowIndex,
    now: nowNode
      ? {
          title: nowNode.title || '',
          status: nowNode.status || '',
        }
      : {},
    params,
    announcementPath: ctx.announcementPath || '',
  }
}

export function syncFurnaceSessionContext(
  sessionId,
  { role, nodeId, keepRole = false } = {},
) {
  const facts = collectFurnaceSituationFacts(sessionId, { nodeId })
  if (!facts) return null
  const nextRole = role || (keepRole ? currentFurnaceRole() : FURNACE_ROLE.SESSION)
  return activateFurnaceRole(nextRole, {
    sessionId,
    nodeId: nodeId || null,
    situation: facts,
  })
}
