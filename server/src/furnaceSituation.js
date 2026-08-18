/**
 * 从当前会话抽出熔炉情境包（槽位填充，不调模型）。
 */
import { getDb, parseJson } from './db.js'
import { FURNACE_ROLE, nodeStatusLabel, stepTypeLabel } from '@acw/shared'
import {
  activateFurnaceRole,
  currentFurnaceRole,
  clipFurnaceText,
  SITUATION_LIMITS,
} from './furnaceContext.js'

function getMember(id) {
  if (!id) return null
  return getDb().prepare('SELECT * FROM members WHERE id = ?').get(id)
}

function digestOutput(outputJson) {
  const o = parseJson(outputJson, null)
  if (o == null || o === '') return ''
  if (typeof o === 'string') return clipFurnaceText(o, SITUATION_LIMITS.prevOut)
  const text = o.text || o.summary || o.stdout || o.result || o.output
  if (text != null && String(text).trim()) {
    return clipFurnaceText(String(text), SITUATION_LIMITS.prevOut)
  }
  try {
    return clipFurnaceText(JSON.stringify(o), SITUATION_LIMITS.prevOut)
  } catch {
    return ''
  }
}

function nodeCard(step, node, member) {
  const type = node?.step_type || step?.type || 'member'
  const flow = step?.flow && typeof step.flow === 'object' ? step.flow : {}
  const adapt = !!(
    step?.adapt ||
    parseJson(node?.input_json, {}).adapt
  )
  return {
    title: node?.title || step?.title || '',
    kind: stepTypeLabel(type),
    member: member?.display_name || member?.name || '',
    adapt,
    gateAdmin: !!flow.admin,
    gateHuman: !!flow.human,
    status: node?.status || '',
    statusLabel: nodeStatusLabel(node?.status) || '',
    stepId: node?.step_id || step?.id || '',
  }
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

  const nowIndex =
    nowNode && Number.isFinite(Number(nowNode.step_index))
      ? Number(nowNode.step_index)
      : Number(session.current_step_index) || 0

  const rows = nodes.length
    ? nodes
    : steps.map((s, i) => ({
        step_index: i,
        step_id: s.id,
        title: s.title,
        step_type: s.type,
        member_id: s.memberId,
        status: 'pending',
        input_json: s.adapt ? JSON.stringify({ adapt: true }) : null,
        output_json: null,
      }))

  const agenda = rows.map((node) => {
    const step = steps[Number(node.step_index)] || steps.find((s) => s.id === node.step_id) || {}
    const member = getMember(node.member_id || step.memberId)
    return nodeCard(step, node, member)
  })

  const nowStep = steps[nowIndex] || {}
  const nowMember = getMember(nowNode?.member_id || nowStep.memberId)
  const nowCard = nowNode ? nodeCard(nowStep, nowNode, nowMember) : {}
  const prev = rows.find((n) => Number(n.step_index) === nowIndex - 1)
  nowCard.prevOutput = prev ? digestOutput(prev.output_json) : ''

  return {
    intent,
    sessionId,
    sessionTitle: session.title || '',
    groupTitle: group?.title || '',
    groupDescription: group?.description || '',
    workFolder: ctx.groupFolder || group?.work_folder || '',
    agenda,
    nowIndex,
    now: nowCard,
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

/** 游标移动时刷新地图；失败不挡流程。 */
export function touchFurnaceWorkflow(sessionId, opts = {}) {
  try {
    return syncFurnaceSessionContext(sessionId, opts)
  } catch (e) {
    console.warn('[acw] furnace workflow', e?.message || e)
    return null
  }
}
