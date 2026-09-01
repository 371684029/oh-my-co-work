// 场外协助（@成员 插队）节点：插入、复用、回归主线归档。
// Imports: store only (below archive/advance/gates in the engine DAG).
import { getDb, parseJson } from '../db.js'
import { emitSession } from '../bus.js'
import {
  NODE_STATUS,
  OFFSITE_MODE,
  SESSION_STATUS,
  STEP_TYPE,
  nowIso,
  uid,
} from '@acw/shared'
import { getSession, updateSession, addMessage, persistNodeIo } from './store.js'

/**
 * 场外插入游标：当前主线步索引（开场未跑则为 0 → 插到最前）。
 */
function resolveOffsiteInsertIndex(sessionId) {
  const session = getSession(sessionId)
  if (!session) return 0
  const cur = Number(session.current_step_index)
  if (!Number.isFinite(cur) || cur < 0) return 0
  return cur
}

/**
 * 在当前时序游标插入一场外段落（开场 @ → 第一位；中途 → 插在当前步前）。
 * 其后节点 step_index +1；current_step_index 同步后移，主线游标仍指向原节点。
 */
function insertOffsiteAtCursor(sessionId, { title } = {}) {
  const db = getDb()
  const list = db
    .prepare(
      `SELECT id FROM node_instances WHERE session_id = ? AND step_type = ?`,
    )
    .all(sessionId, STEP_TYPE.OFFSITE)
  const seq = list.length + 1
  const insertIdx = resolveOffsiteInsertIndex(sessionId)
  const id = uid('node')
  const label = title || (seq <= 1 ? '临时协助' : `临时协助 · ${seq}`)

  const shift = db.prepare(
    `UPDATE node_instances SET step_index = step_index + 1
     WHERE session_id = ? AND step_index >= ?`,
  )
  const insert = db.prepare(
    `INSERT INTO node_instances (id, session_id, step_index, step_id, title, step_type, member_id, status, gate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  const run = db.transaction(() => {
    shift.run(sessionId, insertIdx)
    insert.run(
      id,
      sessionId,
      insertIdx,
      `offsite_assist_${seq}`,
      label,
      STEP_TYPE.OFFSITE,
      null,
      NODE_STATUS.PENDING,
      0,
    )
    const session = getSession(sessionId)
    const cur = Number(session?.current_step_index)
    if (Number.isFinite(cur) && cur >= insertIdx) {
      updateSession(sessionId, { current_step_index: cur + 1 })
    }
  })
  run()

  return db.prepare('SELECT * FROM node_instances WHERE id = ?').get(id)
}

/**
 * 清掉从未启用的场外占位（旧版开聊/打开详情预挂的末尾空节点）。
 * 仅删 pending + step_id=offsite_assist_* + 无实质入出；模板里配置的场外保留。
 */
export function pruneIdleOffsitePlaceholders(sessionId) {
  const rows = getDb()
    .prepare(
      `SELECT * FROM node_instances WHERE session_id = ? AND step_type = ?`,
    )
    .all(sessionId, STEP_TYPE.OFFSITE)
  const del = getDb().prepare('DELETE FROM node_instances WHERE id = ?')
  let removed = 0
  for (const n of rows) {
    if (n.status !== NODE_STATUS.PENDING) continue
    const sid = String(n.step_id || '')
    if (!sid.startsWith('offsite_assist_')) continue
    const input = parseJson(n.input_json, null)
    const output = parseJson(n.output_json, null)
    const hasInput =
      input &&
      typeof input === 'object' &&
      Object.keys(input).some((k) => input[k] != null && String(input[k]).trim?.() !== '')
    const hasOutput =
      output &&
      typeof output === 'object' &&
      (output.assists?.length ||
        output.lastMention ||
        output.archived ||
        output.mode ||
        output.humanAction)
    if (hasInput || hasOutput) continue
    del.run(n.id)
    removed += 1
  }
  return { removed }
}

function offsiteNodeArchived(n) {
  if (!n) return true
  const out = parseJson(n.output_json, {})
  return !!(out.archived || out.closeToken) && n.status === NODE_STATUS.SUCCEEDED
}

/**
 * 解析可写的「场外协助」节点（流动扩展）。
 * - 优先当前未归档的挂起/进行中节点
 * - expand=true：没有可写节点时在**当前时序游标**新建一段（已归档不复用）
 * - expand=false：只返回已有，不新建（开聊不再预挂末尾占位）
 */
export function ensureOffsiteNode(sessionId, { expand = false } = {}) {
  const list = getDb()
    .prepare(
      `SELECT * FROM node_instances WHERE session_id = ? AND step_type = ? ORDER BY step_index`,
    )
    .all(sessionId, STEP_TYPE.OFFSITE)
  const session = getSession(sessionId)
  const ctx = parseJson(session?.context_json, {})
  const pinnedId = ctx.offsiteAssist?.active ? ctx.offsiteAssist?.nodeInstanceId : null

  // 进行中的场外段落优先
  const writable = list.find(
    (n) =>
      !offsiteNodeArchived(n) &&
      (n.status === NODE_STATUS.RUNNING || n.status === NODE_STATUS.WAITING_HUMAN),
  )
  if (writable) return writable

  if (pinnedId && ctx.offsiteAssist?.active) {
    const pinned = list.find((n) => n.id === pinnedId && !offsiteNodeArchived(n))
    if (pinned) return pinned
  }

  // 流动扩展：复用尚未标 running 的 pending（刚插入），再否则按时序游标新建
  if (expand) {
    const pending = [...list]
      .reverse()
      .find((n) => !offsiteNodeArchived(n) && n.status === NODE_STATUS.PENDING)
    if (pending) return pending
    return insertOffsiteAtCursor(sessionId)
  }

  if (!list.length) return null
  return list[list.length - 1]
}

/** 当前场外节点应视为计划挂起还是临时插队 */
export function resolveOffsiteMode(session, offsiteNode) {
  if (!offsiteNode) return OFFSITE_MODE.INTERRUPT
  const ctx = parseJson(session?.context_json, {})
  const out = parseJson(offsiteNode.output_json, {})
  const hung =
    offsiteNode.status === NODE_STATUS.WAITING_HUMAN ||
    offsiteNode.status === NODE_STATUS.RUNNING
  if (
    hung &&
    (ctx.offsiteAssist?.mode === OFFSITE_MODE.PLANNED ||
      out.mode === OFFSITE_MODE.PLANNED ||
      out.plannedPause)
  ) {
    return OFFSITE_MODE.PLANNED
  }
  if (ctx.offsiteAssist?.mode === OFFSITE_MODE.PLANNED && hung) return OFFSITE_MODE.PLANNED
  return OFFSITE_MODE.INTERRUPT
}

/**
 * 用户回归主线：当前场外段落默认完成并归档（可多次；后续 @ 再扩展新段落）。
 */
export function archiveOffsiteOnReturnToMain(sessionId, {
  reason = 'returned_to_main',
  resumeTitle = '',
  resumeNodeId = null,
  resumeStepIndex = null,
  silent = false,
} = {}) {
  const session = getSession(sessionId)
  if (!session) return { closed: [], closeToken: null, hadActive: false }
  const ctx = parseJson(session.context_json, {})
  const list = getDb()
    .prepare(
      `SELECT * FROM node_instances WHERE session_id = ? AND step_type = ? ORDER BY step_index`,
    )
    .all(sessionId, STEP_TYPE.OFFSITE)
  const closeAt = nowIso()
  const closeToken = uid('offclose')
  const closed = []
  const hadActive = !!(
    ctx.offsiteAssist?.active ||
    list.some(
      (n) => n.status === NODE_STATUS.RUNNING || n.status === NODE_STATUS.WAITING_HUMAN,
    )
  )
  if (!hadActive) {
    return { closed: [], closeToken: null, hadActive: false }
  }

  for (const n of list) {
    const hung =
      n.status === NODE_STATUS.RUNNING || n.status === NODE_STATUS.WAITING_HUMAN
    const pinned = ctx.offsiteAssist?.nodeInstanceId === n.id
    if (!hung && !pinned) continue

    const prev = parseJson(n.output_json, {})
    persistNodeIo(sessionId, n.id, {
      input: parseJson(n.input_json, {}),
      output: {
        ...prev,
        archived: true,
        offsiteIdle: true,
        closedAt: closeAt,
        closeToken,
        closeReason: reason,
        humanAction: 'approve',
        resumeTo: {
          stepIndex: resumeStepIndex,
          nodeInstanceId: resumeNodeId,
          title: resumeTitle,
        },
      },
      status: NODE_STATUS.SUCCEEDED,
      finished: true,
    })
    closed.push(n)
  }

  ctx.offsiteAssist = {
    active: false,
    archived: true,
    closedAt: closeAt,
    closeToken,
    reason,
    resumeTitle,
    resumeNodeId,
  }
  updateSession(sessionId, { context_json: JSON.stringify(ctx) })

  if (!silent && (closed.length || hadActive)) {
    const where = resumeTitle ? `「${resumeTitle}」` : '主线节点'
    addMessage(sessionId, {
      role: 'system',
      type: 'status',
      content: {
        text: `已回归正轨 → ${where}（将线性追加克隆并开跑；历史保留）。本段场外已完成并归档；之后还可再开场外段落。`,
        offsite: true,
        offsiteArchived: true,
        resumeTitle,
        resumeNodeId,
      },
    })
  }

  emitSession(sessionId, {
    type: 'session.status',
    payload: {
      sessionId,
      offsiteAssist: false,
      offsiteArchived: true,
      closeToken,
    },
  })

  return { closed, closeToken, hadActive: hadActive || closed.length > 0 }
}

/** 指定场外节点是否已归档（新扩展段落不算） */
export function isOffsiteArchived(sessionId, nodeId) {
  const session = getSession(sessionId)
  if (!session) return true
  if (session.status === SESSION_STATUS.ARCHIVED) return true
  const n = nodeId
    ? getDb().prepare('SELECT * FROM node_instances WHERE id = ?').get(nodeId)
    : null
  if (!n) return true
  if (offsiteNodeArchived(n)) return true
  return false
}

/** 临时协助节点：累积群聊正文，供群报告节点 I/O 展示 */
export function appendOffsiteNodeChat(sessionId, nodeId, text) {
  const note = text != null ? String(text).trim() : ''
  if (!note || !nodeId) return
  const node = getDb().prepare('SELECT * FROM node_instances WHERE id = ?').get(nodeId)
  if (!node || node.step_type !== STEP_TYPE.OFFSITE) return
  const prevIn = parseJson(node.input_json, {})
  const prevOut = parseJson(node.output_json, {})
  const prevHuman = String(prevIn.humanInput || '').trim()
  const humanInput = prevHuman ? `${prevHuman}\n${note}` : note
  persistNodeIo(sessionId, nodeId, {
    input: {
      ...prevIn,
      kind: 'offsite',
      humanInput,
      text: note,
      lastChatAt: nowIso(),
    },
    output: {
      ...prevOut,
      lastChat: note,
    },
  })
}
