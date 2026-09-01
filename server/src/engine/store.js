// Engine primitives: DB row access, session/node/message writes, ctx helpers.
// Lowest engine layer — imported by every other engine module; imports nothing from engine/.
import { getDb, parseJson } from '../db.js'
import { emitSession } from '../bus.js'
import { writeNodeJournal } from '../journal.js'
import {
  SYSTEM_PARAM_KEYS,
  nowIso,
  uid,
  getParamsMap,
  mergeSystemParams,
  abbrGroupTag,
  formatSessionAutoTitle,
} from '@acw/shared'

export function getMember(id) {
  return getDb().prepare('SELECT * FROM members WHERE id = ?').get(id)
}

export function stepAdaptInput(step, extra = {}) {
  const input = { ...extra }
  if (step?.adapt === true || extra.adapt === true) input.adapt = true
  return Object.keys(input).length ? JSON.stringify(input) : null
}

export function getGroup(id) {
  return getDb().prepare('SELECT * FROM groups WHERE id = ?').get(id)
}

export function getSession(id) {
  return getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id)
}

/** 解析成员 config（兼容 config_json 字符串） */
export function parseMemberConfig(member) {
  if (!member) return {}
  if (member.config && typeof member.config === 'object') return member.config
  return parseJson(member.config_json, {})
}

/**
 * CI01：成员是否依赖会话级项目参数 #1
 * - requiresParams: false → 不拦截
 * - requiresParams: ['#1'] / minParams ≥ 1 → 拦截
 * - 否则扫描 defaultText / command / path / args / env 是否引用 #1
 */
export function memberNeedsProjectParams(member) {
  const config = parseMemberConfig(member)
  if (config.requiresParams === false || config.skipParamsCheck === true) return false
  if (Array.isArray(config.requiresParams) && config.requiresParams.length > 0) {
    return config.requiresParams.some((k) => String(k) === '#1' || String(k) === '1')
  }
  if (Number(config.minParams) > 0) return true
  const script = config.script && typeof config.script === 'object' ? config.script : {}
  const envVals =
    script.env && typeof script.env === 'object' ? Object.values(script.env) : []
  const blobs = [
    config.defaultText,
    script.command,
    script.filePath,
    script.path,
    ...(Array.isArray(script.args) ? script.args : []),
    ...envVals,
  ]
    .filter((x) => x != null && String(x).length)
    .map(String)
    .join('\n')
  return /\{#1\}|#1\b|\{1\}/.test(blobs)
}

/** 会话是否已有非空 #1 / paramsList[0] */
export function hasProjectParam1(ctx) {
  const c = ctx || {}
  if (Array.isArray(c.paramsList) && c.paramsList[0] != null && String(c.paramsList[0]).trim()) {
    return true
  }
  const p = c.params && typeof c.params === 'object' ? c.params : {}
  if (p['#1'] != null && String(p['#1']).trim()) return true
  if (p['1'] != null && String(p['1']).trim()) return true
  return false
}

/** X07：闸门附言写入 lastHumanInput + #a */
export function bindGateHumanInput(sessionId, {
  text,
  action,
  actionLabel,
  nodeTitle,
  nodeInstanceId,
}) {
  const full = text != null ? String(text) : ''
  const note = full.trim()
  const session = getSession(sessionId)
  if (!session) return { full, note }
  const ctx = parseJson(session.context_json, {})
  ctx.lastHumanInput = full
  ctx.params = {
    ...(ctx.params && typeof ctx.params === 'object' ? ctx.params : {}),
    [SYSTEM_PARAM_KEYS.CALL_ARGS]: note,
  }
  if (note) {
    ctx.userNotes = Array.isArray(ctx.userNotes) ? ctx.userNotes : []
    ctx.userNotes.push({
      at: nowIso(),
      action,
      actionLabel,
      text: note,
      nodeTitle,
      nodeInstanceId,
    })
  }
  updateSession(sessionId, { context_json: JSON.stringify(ctx) })
  return { full, note }
}

export function updateSession(id, patch) {
  const s = getSession(id)
  if (!s) return
  // 字段显式传入（含 null）则覆盖；未传则保留
  const pick = (key) => (Object.prototype.hasOwnProperty.call(patch, key) ? patch[key] : s[key])
  const next = {
    title: pick('title') ?? s.title,
    status: pick('status') ?? s.status,
    current_step_index:
      pick('current_step_index') != null ? pick('current_step_index') : s.current_step_index,
    context_json: pick('context_json') ?? s.context_json,
    archive_reason: pick('archive_reason'),
    archived_at: pick('archived_at'),
    pinned: pick('pinned') != null ? pick('pinned') : s.pinned,
    updated_at: nowIso(),
  }
  getDb()
    .prepare(
      `UPDATE sessions SET title=?, status=?, current_step_index=?, context_json=?,
       archive_reason=?, archived_at=?, pinned=?, updated_at=? WHERE id=?`,
    )
    .run(
      next.title,
      next.status,
      next.current_step_index,
      next.context_json,
      next.archive_reason,
      next.archived_at,
      next.pinned,
      next.updated_at,
      id,
    )
}

export function addMessage(sessionId, msg) {
  const id = uid('msg')
  const created = nowIso()
  const row = {
    id,
    session_id: sessionId,
    node_instance_id: msg.node_instance_id || null,
    role: msg.role,
    member_id: msg.member_id || null,
    type: msg.type || 'text',
    content_json: JSON.stringify(msg.content ?? {}),
    created_at: created,
  }
  getDb()
    .prepare(
      `INSERT INTO messages (id, session_id, node_instance_id, role, member_id, type, content_json, created_at)
       VALUES (@id, @session_id, @node_instance_id, @role, @member_id, @type, @content_json, @created_at)`,
    )
    .run(row)
  const out = { ...row, content: msg.content ?? {} }
  emitSession(sessionId, { type: 'message', payload: out })
  return out
}

export function updateMessageContent(id, content) {
  const row = getDb().prepare('SELECT * FROM messages WHERE id = ?').get(id)
  if (!row) return null
  getDb()
    .prepare('UPDATE messages SET content_json = ? WHERE id = ?')
    .run(JSON.stringify(content ?? {}), id)
  const next = { ...row, content: content ?? {}, content_json: JSON.stringify(content ?? {}) }
  emitSession(row.session_id, { type: 'message', payload: next })
  return next
}

export function updateNode(id, patch) {
  const n = getDb().prepare('SELECT * FROM node_instances WHERE id = ?').get(id)
  if (!n) return
  const pick = (key, fallback) =>
    Object.prototype.hasOwnProperty.call(patch, key) ? patch[key] : fallback
  getDb()
    .prepare(
      `UPDATE node_instances SET status=?, input_json=?, output_json=?, journal_path=?, started_at=?, finished_at=? WHERE id=?`,
    )
    .run(
      pick('status', n.status),
      pick('input_json', n.input_json),
      pick('output_json', n.output_json),
      pick('journal_path', n.journal_path),
      pick('started_at', n.started_at),
      pick('finished_at', n.finished_at),
      id,
    )
  const sessionId = n.session_id
  emitSession(sessionId, {
    type: 'node.status',
    payload: {
      nodeInstanceId: id,
      stepIndex: n.step_index,
      status: pick('status', n.status),
    },
  })
}

/**
 * 节点对应的群模板步下标（克隆节点记在 output/input.clonedFromStepIndex）
 */
export function templateStepIndexOf(node, stepsLen = Infinity) {
  if (!node) return 0
  const out = parseJson(node.output_json, {})
  const input = parseJson(node.input_json, {})
  const raw =
    out.clonedFromStepIndex ??
    input.clonedFromStepIndex ??
    Number(node.step_index)
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 0
  if (Number.isFinite(stepsLen) && n >= stepsLen) return Math.max(0, stepsLen - 1)
  return n
}

export function resolveStepForNode(node, steps) {
  const list = Array.isArray(steps) ? steps : []
  const ti = templateStepIndexOf(node, list.length)
  return { step: list[ti] || {}, templateIndex: ti }
}

export function nodeLooksCloned(node) {
  if (!node) return false
  const out = parseJson(node.output_json, {})
  const input = parseJson(node.input_json, {})
  return !!(out.cloned || input.cloned)
}

/** 落库 + 写节点 MD 台账 */
function inheritCloneMeta(prev = {}, next = {}) {
  if (!prev?.cloned && !next?.cloned) return next
  return {
    ...next,
    cloned: true,
    cloneBatchId: next.cloneBatchId || prev.cloneBatchId || null,
    clonedFromNodeInstanceId:
      next.clonedFromNodeInstanceId || prev.clonedFromNodeInstanceId || null,
    clonedFromStepIndex:
      next.clonedFromStepIndex ?? prev.clonedFromStepIndex ?? null,
    clonedAt: next.clonedAt || prev.clonedAt || null,
  }
}

function inheritNodeInputMeta(prev = {}, next = {}) {
  const out = inheritCloneMeta(prev, next)
  if (!prev?.adapt && !next?.adapt) return out
  return {
    ...out,
    adapt: true,
    adaptBackup: next.adaptBackup || prev.adaptBackup || null,
    adaptPatched: next.adaptPatched || prev.adaptPatched || [],
    adaptFallback: next.adaptFallback ?? prev.adaptFallback,
    adaptReason: next.adaptReason || prev.adaptReason || null,
  }
}

export function persistNodeIo(sessionId, nodeId, { input, output, status, finished }) {
  const session = getSession(sessionId)
  const n = getDb().prepare('SELECT * FROM node_instances WHERE id = ?').get(nodeId)
  if (!n || !session) return
  let memberName = ''
  if (n.member_id) {
    const m = getMember(n.member_id)
    memberName = m?.display_name || m?.name || ''
  }
  const prevIn = parseJson(n.input_json, {})
  const prevOut = parseJson(n.output_json, {})
  const prevClone = { ...prevIn, ...prevOut }
  const nextInput =
    input !== undefined ? inheritNodeInputMeta(prevClone, input) : undefined
  const nextOutput =
    output !== undefined ? inheritCloneMeta(prevClone, output) : undefined
  const next = {
    ...n,
    status: status ?? n.status,
    started_at: n.started_at,
    finished_at: finished ? nowIso() : n.finished_at,
  }
  let journalPath = n.journal_path
  try {
    journalPath = writeNodeJournal({
      sessionId,
      sessionTitle: session.title,
      node: next,
      input: nextInput !== undefined ? nextInput : prevIn,
      output: nextOutput !== undefined ? nextOutput : prevOut,
      memberName,
    })
  } catch (e) {
    console.warn('[acw] journal write failed', e.message)
  }
  updateNode(nodeId, {
    status: next.status,
    input_json: nextInput !== undefined ? JSON.stringify(nextInput) : undefined,
    output_json: nextOutput !== undefined ? JSON.stringify(nextOutput) : undefined,
    journal_path: journalPath,
    finished_at: next.finished_at,
  })
}

/** 用户参数 + #群聊 名片 + #文件夹 */
export function resolveParamsMap(sessionContext, group) {
  const user = getParamsMap(sessionContext)
  return mergeSystemParams(user, {
    group: group
      ? {
          ...group,
          steps: parseJson(group.steps_json, group.steps || []),
        }
      : null,
    sessionContext,
    memberNameOf: (id) => {
      const m = getMember(id)
      return m?.display_name || m?.name || id
    },
  })
}

/**
 * 未手改标题时：按 #1 + 群模板缩写自动命名
 * @returns {string|null} 新标题；无需改则 null
 */
export function syncAutoSessionTitle(ctx, group) {
  if (!ctx || ctx.titleAuto === false) return null
  const groupTitle =
    ctx.groupTitle || group?.title || group?.display_name || ctx.pendingStart?.groupTitle || ''
  if (!ctx.groupTitle && groupTitle) ctx.groupTitle = groupTitle
  if (!ctx.groupTitleAbbr) ctx.groupTitleAbbr = abbrGroupTag(groupTitle)
  const param1 =
    (Array.isArray(ctx.paramsList) && ctx.paramsList[0]) ||
    ctx.params?.['#1'] ||
    ctx.params?.['1'] ||
    ''
  const next = formatSessionAutoTitle({
    param1,
    groupTitle: ctx.groupTitle,
    groupTitleAbbr: ctx.groupTitleAbbr,
  })
  return next || null
}
