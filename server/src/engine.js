import { getDb, parseJson } from './db.js'
import { emitSession, emitAll } from './bus.js'
import { runMember } from './runners.js'
import {
  killSessionProcesses,
  killMemberProcesses,
  cleanupArchivedSessionPidFiles,
} from './processRegistry.js'
import { appendAdapterReply } from './terminal/adapters/jsonl.js'
import {
  writeNodeJournal,
  writeSessionJournalIndex,
  writeSessionAnnouncement,
  readSessionAnnouncement,
  saveSessionAnnouncementRaw,
} from './journal.js'
import {
  SESSION_STATUS,
  NODE_STATUS,
  STEP_TYPE,
  nowIso,
  uid,
  normalizeStepFlow,
  flowNeedsWait,
  appendProjectParams,
  formatAddedParamsText,
  applyParamPlaceholders,
  getParamsMap,
  mergeSystemParams,
  formatGroupCard,
  resolveGroupFolder,
  SYSTEM_PARAM_KEYS,
  abbrGroupTag,
  formatSessionAutoTitle,
  injectCallArgsParam,
  extractCallArgsFromMention,
  isMentionAssistOnly,
  OFFSITE_MODE,
} from '@acw/shared'
import { resolveGroupAdmin } from './appSettings.js'

function getMember(id) {
  return getDb().prepare('SELECT * FROM members WHERE id = ?').get(id)
}

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

/**
 * 兼容旧会话：只返回已有归档尾节点，不再新建。
 * 释放资源改到设置里手动操作，流程轨不再挂归档步。
 */
export function ensureArchiveTailNode(sessionId) {
  return (
    getDb()
      .prepare(
        `SELECT * FROM node_instances WHERE session_id = ? AND step_type = ? ORDER BY step_index DESC LIMIT 1`,
      )
      .get(sessionId, STEP_TYPE.ARCHIVE) || null
  )
}

function skipArchiveNode(sessionId, node, reason = 'completed') {
  if (!node) return
  if (node.status === NODE_STATUS.SUCCEEDED || node.status === NODE_STATUS.SKIPPED) return
  persistNodeIo(sessionId, node.id, {
    input: { kind: 'archive', skipped: true, reason },
    output: { skipped: true, skipReason: 'settings_release', reason },
    status: NODE_STATUS.SKIPPED,
    finished: true,
  })
}

/**
 * 清掉待确认归档闸门，不杀进程、不改成 archived。
 * 旧会话打开或流程走完时调用。
 */
export function dismissPendingArchiveIfAny(sessionId, reason = 'completed') {
  const session = getSession(sessionId)
  if (!session) return null
  if (session.status === SESSION_STATUS.ARCHIVED) return null
  if (session.status === SESSION_STATUS.INTERRUPTED) return null
  const db = getDb()
  const archNodes = db
    .prepare(`SELECT * FROM node_instances WHERE session_id = ? AND step_type = ?`)
    .all(sessionId, STEP_TYPE.ARCHIVE)
  for (const node of archNodes) {
    skipArchiveNode(sessionId, node, reason)
  }
  const s2 = getSession(sessionId)
  const ctx = parseJson(s2?.context_json, {})
  const hadPending = !!ctx.pendingArchive
  delete ctx.pendingArchive
  const otherWait =
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM node_instances WHERE session_id = ? AND status = ? AND IFNULL(step_type,'') != ?`,
      )
      .get(sessionId, NODE_STATUS.WAITING_HUMAN, STEP_TYPE.ARCHIVE)?.c || 0
  const patch = { context_json: JSON.stringify(ctx) }
  if (s2.status === SESSION_STATUS.WAITING_HUMAN && hadPending && otherWait === 0) {
    patch.status =
      reason === 'failed' || reason === 'rejected'
        ? SESSION_STATUS.FAILED
        : SESSION_STATUS.ACTIVE
  }
  updateSession(sessionId, patch)
  return null
}

function markArchiveNodeDone(sessionId, { reason, note } = {}) {
  const node = getDb()
    .prepare(
      `SELECT * FROM node_instances WHERE session_id = ? AND step_type = ? ORDER BY step_index DESC LIMIT 1`,
    )
    .get(sessionId, STEP_TYPE.ARCHIVE)
  if (!node) return null
  const prev = parseJson(node.output_json, {})
  persistNodeIo(sessionId, node.id, {
    input: parseJson(node.input_json, { kind: 'archive' }),
    output: {
      ...prev,
      archived: true,
      sessionArchived: true,
      humanAction: 'approve',
      reason: reason || prev.reason || 'manual',
      note: note || undefined,
      at: nowIso(),
    },
    status: NODE_STATUS.SUCCEEDED,
  })
  return node
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
function resolveOffsiteMode(session, offsiteNode) {
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
function archiveOffsiteOnReturnToMain(sessionId, {
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
function isOffsiteArchived(sessionId, nodeId) {
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

function getGroup(id) {
  return getDb().prepare('SELECT * FROM groups WHERE id = ?').get(id)
}

function getSession(id) {
  return getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id)
}

/** 解析成员 config（兼容 config_json 字符串） */
function parseMemberConfig(member) {
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
function memberNeedsProjectParams(member) {
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
function hasProjectParam1(ctx) {
  const c = ctx || {}
  if (Array.isArray(c.paramsList) && c.paramsList[0] != null && String(c.paramsList[0]).trim()) {
    return true
  }
  const p = c.params && typeof c.params === 'object' ? c.params : {}
  if (p['#1'] != null && String(p['#1']).trim()) return true
  if (p['1'] != null && String(p['1']).trim()) return true
  return false
}

/** R03：读取闸门幂等缓存 */
function readGateIdempotency(sessionId, key) {
  if (!key) return null
  const session = getSession(sessionId)
  if (!session) return null
  const ctx = parseJson(session.context_json, {})
  const cache = ctx.gateIdempotency && typeof ctx.gateIdempotency === 'object' ? ctx.gateIdempotency : {}
  return cache[key] || null
}

/** R03：写入闸门幂等缓存（最多保留 40 条；只存精简结果） */
function rememberGateIdempotency(sessionId, key, result) {
  if (!key) return
  const session = getSession(sessionId)
  if (!session) return
  const ctx = parseJson(session.context_json, {})
  const prev =
    ctx.gateIdempotency && typeof ctx.gateIdempotency === 'object' ? ctx.gateIdempotency : {}
  const slim =
    result && typeof result === 'object'
      ? {
          ok: result.ok !== false,
          action: result.action,
          passed: result.passed,
          rejected: result.rejected,
          cancelled: result.cancelled,
          archived: result.archived,
          deferred: result.deferred,
          started: result.started,
          submitted: result.submitted,
          needParamsFilled: result.needParamsFilled,
          idempotent: result.idempotent,
        }
      : { ok: true }
  const next = { ...prev, [key]: { at: nowIso(), result: slim } }
  const keys = Object.keys(next)
  if (keys.length > 40) {
    keys
      .sort((a, b) => String(next[a]?.at || '').localeCompare(String(next[b]?.at || '')))
      .slice(0, keys.length - 40)
      .forEach((k) => {
        delete next[k]
      })
  }
  ctx.gateIdempotency = next
  updateSession(sessionId, { context_json: JSON.stringify(ctx) })
}

/** X07：闸门附言写入 lastHumanInput + #a */
function bindGateHumanInput(sessionId, {
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

/**
 * 群聊用户消息：追加 #1… 参数并记入群报告 userNotes（与人工闸门提交共用同一套 paramsList）
 */
function recordUserChatInput(
  sessionId,
  text,
  {
    action = 'chat',
    actionLabel = '群聊',
    nodeTitle,
    nodeInstanceId,
  } = {},
) {
  const note = text != null ? String(text).trim() : ''
  if (!note) return null
  const session = getSession(sessionId)
  if (!session) return null
  const group = getGroup(session.group_id)
  const steps = parseJson(group?.steps_json, [])
  const ctx = parseJson(session.context_json, {})
  ctx.lastHumanInput = note
  const parsed = appendProjectParams(ctx, note)
  ctx.projectInfoRaw = [ctx.projectInfoRaw, parsed.raw]
    .filter((s) => s != null && String(s).trim())
    .join('\n')
  ctx.paramsList = parsed.list
  const gObj = group ? { ...group, steps } : null
  const sysCard =
    ctx.params?.[SYSTEM_PARAM_KEYS.GROUP_CARD] ||
    ctx.groupCard ||
    (gObj
      ? formatGroupCard(gObj, {
          memberNameOf: (id) => {
            const m = getMember(id)
            return m?.display_name || m?.name || id
          },
        })
      : '')
  if (sysCard) ctx.groupCard = sysCard
  if (gObj) ctx.groupFolder = resolveGroupFolder(gObj, ctx)
  ctx.params = mergeSystemParams(
    {
      ...parsed.map,
      [SYSTEM_PARAM_KEYS.CALL_ARGS]: note,
    },
    {
      group: gObj,
      sessionContext: ctx,
      memberNameOf: (id) => {
        const m = getMember(id)
        return m?.display_name || m?.name || id
      },
    },
  )
  ctx.userNotes = Array.isArray(ctx.userNotes) ? ctx.userNotes : []
  ctx.userNotes.push({
    at: nowIso(),
    action,
    actionLabel,
    text: note,
    nodeTitle: nodeTitle || undefined,
    nodeInstanceId: nodeInstanceId || undefined,
  })
  const autoTitle = syncAutoSessionTitle(ctx, group)
  updateSession(sessionId, {
    context_json: JSON.stringify(ctx),
    ...(autoTitle ? { title: autoTitle } : {}),
  })
  refreshSessionAnnouncement(sessionId)
  return parsed
}

/** 临时协助节点：累积群聊正文，供群报告节点 I/O 展示 */
function appendOffsiteNodeChat(sessionId, nodeId, text) {
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

/** 用户参数 + #群聊 名片 + #文件夹 */
function resolveParamsMap(sessionContext, group) {
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
function syncAutoSessionTitle(ctx, group) {
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

function updateSession(id, patch) {
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

function addMessage(sessionId, msg) {
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

function updateMessageContent(id, content) {
  const row = getDb().prepare('SELECT * FROM messages WHERE id = ?').get(id)
  if (!row) return null
  getDb()
    .prepare('UPDATE messages SET content_json = ? WHERE id = ?')
    .run(JSON.stringify(content ?? {}), id)
  const next = { ...row, content: content ?? {}, content_json: JSON.stringify(content ?? {}) }
  emitSession(row.session_id, { type: 'message', payload: next })
  return next
}

/**
 * Trusted JSONL adapter events → chat / gates / node output.
 * Failures must not throw into the PTY watcher.
 */
export function applyAdapterEvent({
  sessionId,
  nodeInstanceId,
  memberId,
  terminalId,
  replyPath,
  event,
}) {
  if (!sessionId || !event?.type) return
  const session = getSession(sessionId)
  if (!session || session.status === SESSION_STATUS.ARCHIVED) return
  try {
    if (event.type === 'message') {
      addMessage(sessionId, {
        role: event.role === 'user' ? 'user' : 'assistant',
        member_id: memberId || null,
        node_instance_id: nodeInstanceId || null,
        type: 'adapter_message',
        content: { text: event.text, terminalId, adapter: 'jsonl' },
      })
      return
    }
    if (event.type === 'tool.start' || event.type === 'tool.end') {
      const started = event.type === 'tool.start'
      addMessage(sessionId, {
        role: 'assistant',
        member_id: memberId || null,
        node_instance_id: nodeInstanceId || null,
        type: 'adapter_tool',
        content: {
          text: started
            ? `工具 ${event.name}${event.path ? ` · ${event.path}` : ''} 开始`
            : `工具 ${event.id} ${event.ok === false ? '失败' : '结束'}${event.summary ? `：${event.summary}` : ''}`,
          toolId: event.id,
          name: event.name,
          path: event.path,
          ok: event.ok,
          phase: started ? 'start' : 'end',
          terminalId,
        },
      })
      return
    }
    if (event.type === 'question') {
      const ctx = parseJson(session.context_json, {})
      const pending = Array.isArray(ctx.pendingAdapterQuestions) ? ctx.pendingAdapterQuestions : []
      if (pending.some((q) => q.id === event.id)) return
      pending.push({
        id: event.id,
        text: event.text,
        choices: event.choices || [],
        terminalId,
        replyPath: replyPath || null,
        nodeInstanceId: nodeInstanceId || null,
        memberId: memberId || null,
      })
      ctx.pendingAdapterQuestions = pending
      updateSession(sessionId, { context_json: JSON.stringify(ctx) })
      addMessage(sessionId, {
        role: 'system',
        type: 'gate',
        node_instance_id: nodeInstanceId || null,
        member_id: memberId || null,
        content: {
          text: event.text,
          mode: 'adapter_question',
          questionId: event.id,
          choices: event.choices || [],
          terminalId,
          actions: (event.choices || []).length ? ['adapter_answer'] : ['adapter_answer', 'approve', 'reject'],
          humanAction: 'pending',
        },
      })
      emitSession(sessionId, {
        type: 'gate.request',
        payload: {
          mode: 'adapter_question',
          questionId: event.id,
          terminalId,
          nodeInstanceId,
        },
      })
      return
    }
    if (event.type === 'result') {
      addMessage(sessionId, {
        role: 'assistant',
        member_id: memberId || null,
        node_instance_id: nodeInstanceId || null,
        type: 'adapter_result',
        content: {
          text: event.summary,
          files: event.files || [],
          terminalId,
          adapter: 'jsonl',
        },
      })
      if (nodeInstanceId) {
        const node = getDb().prepare('SELECT * FROM node_instances WHERE id = ?').get(nodeInstanceId)
        if (node) {
          const prev = parseJson(node.output_json, {})
          updateNode(nodeInstanceId, {
            output_json: JSON.stringify({
              ...prev,
              adapterResult: {
                summary: event.summary,
                files: event.files || [],
                terminalId,
                at: nowIso(),
              },
            }),
          })
        }
      }
      try {
        refreshSessionAnnouncement(sessionId)
      } catch {
        /* announcement is best-effort */
      }
    }
  } catch (error) {
    console.warn('[acw] adapter event failed', error?.message || error)
  }
}

export function answerAdapterQuestion(sessionId, { questionId, text, choice, action } = {}) {
  const session = getSession(sessionId)
  if (!session) throw new Error('会话不存在')
  const ctx = parseJson(session.context_json, {})
  const pending = Array.isArray(ctx.pendingAdapterQuestions) ? ctx.pendingAdapterQuestions : []
  const q = pending.find((item) => item.id === questionId) || pending[0]
  if (!q) throw new Error('当前没有待回答的工具提问')
  const answerText =
    choice != null && String(choice)
      ? String(choice)
      : text != null && String(text).trim()
        ? String(text).trim()
        : action === 'reject'
          ? '取消'
          : '继续'
  if (q.replyPath) {
    try {
      appendAdapterReply(q.replyPath, {
        type: 'answer',
        at: nowIso(),
        id: q.id,
        terminalId: q.terminalId,
        text: answerText,
        choice: choice != null ? String(choice) : undefined,
        ok: action !== 'reject',
      })
    } catch {
      /* sidecar write is best-effort */
    }
  }
  ctx.pendingAdapterQuestions = pending.filter((item) => item.id !== q.id)
  updateSession(sessionId, { context_json: JSON.stringify(ctx) })
  const row = getDb()
    .prepare(
      `SELECT * FROM messages WHERE session_id = ? AND type = 'gate' ORDER BY created_at DESC`,
    )
    .all(sessionId)
    .find((m) => parseJson(m.content_json, {})?.questionId === q.id)
  if (row) {
    const content = parseJson(row.content_json, {})
    updateMessageContent(row.id, {
      ...content,
      humanAction: action === 'reject' ? 'reject' : 'approve',
      answered: true,
      answer: answerText,
    })
  }
  addMessage(sessionId, {
    role: 'user',
    type: 'gate',
    node_instance_id: q.nodeInstanceId || null,
    content: {
      text: answerText,
      mode: 'adapter_question',
      questionId: q.id,
      answered: true,
      humanAction: action === 'reject' ? 'reject' : 'approve',
    },
  })
  return { ok: true, questionId: q.id, answer: answerText }
}

function updateNode(id, patch) {
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
function templateStepIndexOf(node, stepsLen = Infinity) {
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

function resolveStepForNode(node, steps) {
  const list = Array.isArray(steps) ? steps : []
  const ti = templateStepIndexOf(node, list.length)
  return { step: list[ti] || {}, templateIndex: ti }
}

function nodeLooksCloned(node) {
  if (!node) return false
  const out = parseJson(node.output_json, {})
  const input = parseJson(node.input_json, {})
  return !!(out.cloned || input.cloned)
}

/**
 * 「从这里继续」后：旧轨上仍 waiting/running/pending（含未跑过的归档）标为跳过（已绕过），
 * 避免多处「待确认」抢交互，并让流程轨折叠这些废弃节点。
 * - beforeStepIndex 有值（往前跳）：只处理该下标之前的节点
 * - 无 beforeStepIndex（往回/再跑克隆）：旧轨上未完成的一并绕过
 */
function bypassAbandonedNodes(sessionId, { keepNodeIds = [], beforeStepIndex = null } = {}) {
  const keep = new Set((keepNodeIds || []).filter(Boolean))
  const nodes = getDb()
    .prepare('SELECT * FROM node_instances WHERE session_id = ? ORDER BY step_index')
    .all(sessionId)
  const at = nowIso()
  const cut =
    beforeStepIndex != null && Number.isFinite(Number(beforeStepIndex))
      ? Number(beforeStepIndex)
      : null
  let n = 0
  for (const node of nodes) {
    if (keep.has(node.id)) continue
    const idx = Number(node.step_index)
    if (cut != null && idx >= cut) continue
    const abandon =
      node.status === NODE_STATUS.WAITING_HUMAN ||
      node.status === NODE_STATUS.RUNNING ||
      node.status === NODE_STATUS.PENDING
    if (!abandon) continue
    const prevOut = parseJson(node.output_json, {})
    updateNode(node.id, {
      status: NODE_STATUS.SKIPPED,
      finished_at: at,
      output_json: JSON.stringify({
        ...prevOut,
        bypassed: true,
        bypassReason: 'continue_from_here',
        bypassedAt: at,
        previousStatus: node.status,
        humanAction: prevOut.humanAction === 'pending' ? 'bypassed' : prevOut.humanAction,
      }),
    })
    n += 1
  }
  return n
}

/**
 * 回退重开：自目标模板步起，跳过场外，按模板线性追加克隆节点
 */
function appendClonedSuffixFrom(sessionId, target, steps) {
  const list = Array.isArray(steps) ? steps : []
  const startTpl = templateStepIndexOf(target, list.length)
  const existing = getDb()
    .prepare(
      `SELECT * FROM node_instances WHERE session_id = ? ORDER BY step_index`,
    )
    .all(sessionId)
  const maxRow = getDb()
    .prepare(`SELECT MAX(step_index) AS m FROM node_instances WHERE session_id = ?`)
    .get(sessionId)
  let nextIdx = maxRow?.m == null ? 0 : Number(maxRow.m) + 1
  const insertNode = getDb().prepare(
    `INSERT INTO node_instances (id, session_id, step_index, step_id, title, step_type, member_id, status, gate, input_json, output_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const created = []
  const batchId = uid('clone')
  const at = nowIso()

  for (let t = startTpl; t < list.length; t++) {
    const step = list[t] || {}
    const st = step.type || STEP_TYPE.MEMBER
    if (st === STEP_TYPE.OFFSITE || st === STEP_TYPE.ARCHIVE) continue

    const src =
      existing.find(
        (n) =>
          n.step_type !== STEP_TYPE.OFFSITE &&
          n.step_type !== STEP_TYPE.ARCHIVE &&
          templateStepIndexOf(n, list.length) === t &&
          Number(n.step_index) >= Number(target.step_index),
      ) ||
      existing.find(
        (n) =>
          n.step_type !== STEP_TYPE.OFFSITE &&
          n.step_type !== STEP_TYPE.ARCHIVE &&
          templateStepIndexOf(n, list.length) === t,
      ) ||
      (templateStepIndexOf(target, list.length) === t ? target : null)

    const flow = normalizeStepFlow(step.flow, step.gate)
    const id = uid('node')
    const title = src?.title || step.title || `步骤 ${t + 1}`
    const meta = {
      cloned: true,
      cloneBatchId: batchId,
      clonedFromNodeInstanceId: src?.id || target.id,
      clonedFromStepIndex: t,
      clonedAt: at,
    }
    insertNode.run(
      id,
      sessionId,
      nextIdx,
      step.id || src?.step_id || `step_${t}`,
      title,
      st,
      st === STEP_TYPE.HUMAN ? null : step.memberId || src?.member_id || null,
      NODE_STATUS.PENDING,
      flowNeedsWait(flow) || step.gate ? 1 : 0,
      JSON.stringify({ ...meta }),
      JSON.stringify({ ...meta }),
    )
    created.push(
      getDb().prepare('SELECT * FROM node_instances WHERE id = ?').get(id),
    )
    nextIdx += 1
  }
  return { created, batchId, startTpl }
}

/**
 * 解档：归档只释放资源；同一会话可无限归档/解档，不新建群聊。
 */
export function unarchiveSession(sessionId, { silent = false, reason = 'manual' } = {}) {
  const session = getSession(sessionId)
  if (!session) throw new Error('会话不存在')
  if (session.status !== SESSION_STATUS.ARCHIVED) return getSession(sessionId)

  const ctx = parseJson(session.context_json, {})
  delete ctx.pendingArchive
  ctx.lastUnarchive = { at: nowIso(), reason }
  const waiting = getDb()
    .prepare(
      `SELECT id FROM node_instances WHERE session_id = ? AND status = ? AND step_type != ? LIMIT 1`,
    )
    .get(sessionId, NODE_STATUS.WAITING_HUMAN, STEP_TYPE.OFFSITE)
  const nextStatus = waiting ? SESSION_STATUS.WAITING_HUMAN : SESSION_STATUS.ACTIVE
  updateSession(sessionId, {
    status: nextStatus,
    archive_reason: null,
    archived_at: null,
    context_json: JSON.stringify(ctx),
  })
  if (!silent) {
    addMessage(sessionId, {
      role: 'system',
      type: 'status',
      content: {
        text: '已恢复。仍在本会话。续跑请右侧「从这里继续」；可再次归档。',
        unarchived: true,
      },
    })
  }
  emitSession(sessionId, {
    type: 'session.status',
    payload: { sessionId, status: nextStatus, unarchived: true },
  })
  emitAll({
    type: 'session.status',
    payload: { sessionId, status: nextStatus, unarchived: true },
  })
  return getSession(sessionId)
}

/**
 * 从指定节点继续
 * - 往前跳到尚未完成的原轨节点：不追加克隆，游标直达；旧待确认标「已绕过」
 * - 往回 / 再跑：线性追加克隆；旧待确认同样绕过
 * - 若已归档：先解档（归档只省资源）
 *
 * @param {string} sessionId
 * @param {{ nodeInstanceId?: string, stepIndex?: number }} opts
 */
export async function restartFromNode(sessionId, opts = {}) {
  let session = getSession(sessionId)
  if (!session) throw new Error('会话不存在')

  if (session.status === SESSION_STATUS.ARCHIVED) {
    unarchiveSession(sessionId, { silent: true, reason: 'restart_from_node' })
    session = getSession(sessionId)
  }

  const nodes = getDb()
    .prepare('SELECT * FROM node_instances WHERE session_id = ? ORDER BY step_index')
    .all(sessionId)
  if (!nodes.length) throw new Error('无流程节点')

  let target = null
  if (opts.nodeInstanceId) {
    target = nodes.find((n) => n.id === opts.nodeInstanceId)
  } else if (opts.stepIndex != null && opts.stepIndex !== '') {
    target = nodes.find((n) => Number(n.step_index) === Number(opts.stepIndex))
  }
  if (!target) throw new Error('目标节点不存在')
  if (target.step_type === STEP_TYPE.OFFSITE) {
    throw Object.assign(
      new Error('临时协助没有「重新开始」；请在右侧选正常节点「从这里继续」'),
      { code: 'OFFSITE_NOT_RESTART_TARGET' },
    )
  }
  if (target.step_type === STEP_TYPE.ARCHIVE) {
    throw Object.assign(
      new Error('归档节点没有「重新开始」；请选择正常流程节点'),
      { code: 'ARCHIVE_NOT_RESTART_TARGET' },
    )
  }

  const idx = Number(target.step_index)
  const curIdx = Number(session.current_step_index)
  const group = getGroup(session.group_id)
  const steps = parseJson(group?.steps_json, [])

  try {
    killSessionProcesses(sessionId)
  } catch {
    /* ignore */
  }

  const ctx = parseJson(session.context_json, {})
  delete ctx.pendingArchive
  updateSession(sessionId, { context_json: JSON.stringify(ctx) })

  const targetDone =
    target.status === NODE_STATUS.SUCCEEDED || target.status === NODE_STATUS.SKIPPED
  /** 往前跳：目标在游标之后、非克隆、尚未完成 → 不追加，直达 */
  const forwardJump =
    Number.isFinite(idx) &&
    Number.isFinite(curIdx) &&
    idx > curIdx &&
    !nodeLooksCloned(target) &&
    !targetDone

  if (forwardJump) {
    bypassAbandonedNodes(sessionId, {
      keepNodeIds: [target.id],
      beforeStepIndex: idx,
    })
    // 仅把「执行中」收回待跑以便重入；已在待确认的保留闸门，勿清空产出重跑
    if (target.status === NODE_STATUS.RUNNING) {
      const prevOut = parseJson(target.output_json, {})
      updateNode(target.id, {
        status: NODE_STATUS.PENDING,
        finished_at: null,
        started_at: null,
        output_json: JSON.stringify({
          ...prevOut,
          humanAction: 'pending',
          resumedByForwardJump: true,
        }),
      })
    }

    const offClose = archiveOffsiteOnReturnToMain(sessionId, {
      reason: 'forward_jump',
      resumeTitle: target.title || `步骤 ${idx + 1}`,
      resumeNodeId: target.id,
      resumeStepIndex: idx,
      silent: false,
    })
    const ctx2 = parseJson(getSession(sessionId)?.context_json, {})
    ctx2.lastRestart = {
      at: nowIso(),
      stepIndex: idx,
      nodeInstanceId: target.id,
      title: target.title || `步骤 ${idx + 1}`,
      fromStatus: session.status,
      fromOffsite: !!offClose.hadActive,
      offsiteArchived: !!offClose.hadActive,
      cloned: false,
      forwardJump: true,
      sourceNodeInstanceId: target.id,
      sourceStepIndex: idx,
    }
    updateSession(sessionId, {
      status: SESSION_STATUS.ACTIVE,
      current_step_index: idx,
      context_json: JSON.stringify(ctx2),
      archive_reason: null,
      archived_at: null,
    })
    addMessage(sessionId, {
      role: 'system',
      type: 'status',
      content: {
        text: `已跳到「${target.title || `步骤 ${idx + 1}`}」继续（未追加克隆；途经节点已绕过）`,
        restartFrom: {
          stepIndex: idx,
          nodeInstanceId: target.id,
          sourceNodeInstanceId: target.id,
          sourceStepIndex: idx,
          cloned: false,
          forwardJump: true,
        },
      },
    })
    emitSession(sessionId, {
      type: 'session.restart',
      payload: {
        sessionId,
        stepIndex: idx,
        nodeInstanceId: target.id,
        title: target.title,
        cloned: false,
        forwardJump: true,
      },
    })
    emitSession(sessionId, {
      type: 'session.status',
      payload: {
        sessionId,
        status: SESSION_STATUS.ACTIVE,
        currentStepIndex: idx,
        cloned: false,
        forwardJump: true,
      },
    })
    emitAll({
      type: 'session.restart',
      payload: { sessionId, stepIndex: idx, cloned: false, forwardJump: true },
    })
    setImmediate(() => advance(sessionId).catch(console.error))
    return {
      ok: true,
      sessionId,
      stepIndex: idx,
      nodeInstanceId: target.id,
      title: target.title,
      cloned: false,
      forwardJump: true,
      sourceNodeInstanceId: target.id,
      sourceStepIndex: idx,
      offsiteArchived: !!offClose.hadActive,
      session: getSession(sessionId),
    }
  }

  bypassAbandonedNodes(sessionId, { keepNodeIds: [] })

  const { created, batchId } = appendClonedSuffixFrom(sessionId, target, steps)
  if (!created.length) {
    throw Object.assign(new Error('没有可克隆的正常流程节点'), {
      code: 'RESTART_CLONE_EMPTY',
    })
  }
  const startNode = created[0]
  const startIdx = Number(startNode.step_index)
  const clonedCount = created.length
  const cloneBatchId = batchId

  const offClose = archiveOffsiteOnReturnToMain(sessionId, {
    reason: 'clone_restart',
    resumeTitle: startNode.title || target.title || `步骤 ${idx + 1}`,
    resumeNodeId: startNode.id,
    resumeStepIndex: startIdx,
    silent: false,
  })
  const ctx2 = parseJson(getSession(sessionId)?.context_json, {})
  ctx2.lastRestart = {
    at: nowIso(),
    stepIndex: startIdx,
    nodeInstanceId: startNode.id,
    title: startNode.title || target.title || `步骤 ${idx + 1}`,
    fromStatus: session.status,
    fromOffsite: !!offClose.hadActive,
    offsiteArchived: !!offClose.hadActive,
    cloned: true,
    cloneBatchId,
    clonedCount,
    sourceNodeInstanceId: target.id,
    sourceStepIndex: idx,
  }

  updateSession(sessionId, {
    status: SESSION_STATUS.ACTIVE,
    current_step_index: startIdx,
    context_json: JSON.stringify(ctx2),
    archive_reason: null,
    archived_at: null,
  })

  addMessage(sessionId, {
    role: 'system',
    type: 'status',
    content: {
      text: `已从「${target.title || `步骤 ${idx + 1}`}」线性追加 ${clonedCount} 个克隆节点并开始（历史保留；途经待确认已绕过）`,
      restartFrom: {
        stepIndex: startIdx,
        nodeInstanceId: startNode.id,
        sourceNodeInstanceId: target.id,
        sourceStepIndex: idx,
        cloned: true,
        cloneBatchId,
        clonedCount,
      },
    },
  })

  emitSession(sessionId, {
    type: 'session.restart',
    payload: {
      sessionId,
      stepIndex: startIdx,
      nodeInstanceId: startNode.id,
      title: startNode.title,
      cloned: true,
      cloneBatchId,
      sourceNodeInstanceId: target.id,
    },
  })
  emitSession(sessionId, {
    type: 'session.status',
    payload: {
      sessionId,
      status: SESSION_STATUS.ACTIVE,
      currentStepIndex: startIdx,
      cloned: true,
    },
  })
  emitAll({
    type: 'session.restart',
    payload: { sessionId, stepIndex: startIdx, cloned: true },
  })

  setImmediate(() => advance(sessionId).catch(console.error))
  return {
    ok: true,
    sessionId,
    stepIndex: startIdx,
    nodeInstanceId: startNode.id,
    title: startNode.title,
    cloned: true,
    cloneBatchId,
    clonedCount,
    sourceNodeInstanceId: target.id,
    sourceStepIndex: idx,
    offsiteArchived: !!offClose.hadActive,
    session: getSession(sessionId),
  }
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

function persistNodeIo(sessionId, nodeId, { input, output, status, finished }) {
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
    input !== undefined ? inheritCloneMeta(prevClone, input) : undefined
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

export function createSessionFromGroup(groupId, { title } = {}) {
  const group = getGroup(groupId)
  if (!group || !group.enabled) throw new Error('群模板不存在或未启用')
  const steps = parseJson(group.steps_json, [])
  if (!steps.length) throw new Error('群模板没有步骤')

  const sessionId = uid('ses')
  const t = nowIso()
  const groupTitle = group.title || '未命名群'
  const groupTitleAbbr = abbrGroupTag(groupTitle)
  // 默认名：有传入 title 用传入；否则先用模板缩写（有 #1 后再自动拼上）
  const sessionTitle =
    title ||
    formatSessionAutoTitle({ groupTitle, groupTitleAbbr }) ||
    groupTitle
  const groupForCard = {
    ...group,
    steps: steps,
  }
  const groupCard = formatGroupCard(groupForCard, {
    memberNameOf: (id) => {
      const m = getMember(id)
      return m?.display_name || m?.name || id
    },
  })
  const groupFolder = resolveGroupFolder(group, {
    workFolders: group.work_folder ? [group.work_folder] : [],
    primaryWorkFolder: group.work_folder || undefined,
  })
  const groupWithConfig = {
    ...group,
    steps,
    config: parseJson(group.config_json, group.config || {}),
  }
  const isAdhoc = groupWithConfig.config?.adhoc === true
  const adminResolved = resolveGroupAdmin(groupWithConfig)
  const ctx = {
    workFolders: group.work_folder ? [group.work_folder] : [],
    primaryWorkFolder: group.work_folder || undefined,
    // 系统参数：#群聊 名片 · #文件夹 路径
    params: {
      [SYSTEM_PARAM_KEYS.GROUP_CARD]: groupCard,
      群聊: groupCard,
      [SYSTEM_PARAM_KEYS.GROUP_FOLDER]: groupFolder,
      文件夹: groupFolder,
      [SYSTEM_PARAM_KEYS.CALL_ARGS]: '',
    },
    paramsList: [],
    groupCard,
    groupFolder,
    groupTitle,
    groupTitleAbbr,
    /** 未手改标题时，采集 #1 后自动改成「#1 · 缩写」 */
    titleAuto: title ? false : true,
    // 管理员：继承全局 / 群自定义 / 可不填
    admin: {
      inherit: adminResolved.inherit,
      memberId: adminResolved.memberId,
      memberName: adminResolved.member?.display_name || null,
    },
  }
  if (!isAdhoc) {
    ctx.pendingStart = {
      at: t,
      groupTitle,
      captureParams: true,
      callArgs: false,
    }
  }

  getDb()
    .prepare(
      `INSERT INTO sessions (id, group_id, title, status, current_step_index, context_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
    )
    .run(
      sessionId,
      groupId,
      sessionTitle,
      isAdhoc ? SESSION_STATUS.ACTIVE : SESSION_STATUS.WAITING_HUMAN,
      JSON.stringify(ctx),
      t,
      t,
    )

  const insertNode = getDb().prepare(
    `INSERT INTO node_instances (id, session_id, step_index, step_id, title, step_type, member_id, status, gate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  steps.forEach((step, i) => {
    const flow = normalizeStepFlow(step.flow, step.gate)
    const st = step.type || STEP_TYPE.MEMBER
    insertNode.run(
      uid('node'),
      sessionId,
      i,
      step.id || `step_${i}`,
      st === STEP_TYPE.OFFSITE
        ? step.title || '临时协助'
        : step.title || `步骤 ${i + 1}`,
      st,
      st === STEP_TYPE.OFFSITE ? null : step.memberId || null,
      NODE_STATUS.PENDING,
      st === STEP_TYPE.OFFSITE ? 0 : flowNeedsWait(flow) || step.gate ? 1 : 0,
    )
  })
  // 场外不在开聊时预挂末尾；首次 @ / 插队时按当前时序游标插入
  // 不再挂归档尾节点：释放资源改到设置里手动操作

  if (isAdhoc) {
    addMessage(sessionId, {
      role: 'system',
      type: 'status',
      content: { text: `已与「${group.title}」开聊。发消息继续；@ 其他成员可临时协助。` },
    })
    emitAll({ type: 'session.created', payload: { sessionId, groupId } })
    emitSession(sessionId, {
      type: 'session.status',
      payload: { sessionId, status: SESSION_STATUS.ACTIVE, pendingStart: false },
    })
    setTimeout(() => {
      advance(sessionId).catch((e) => console.warn('[acw] adhoc start', e?.message || e))
    }, 0)
    return getSession(sessionId)
  }

  addMessage(sessionId, {
    role: 'system',
    type: 'status',
    content: { text: `任务已创建，使用模板「${group.title}」。请确认后开始。` },
  })
  addMessage(sessionId, {
    role: 'system',
    type: 'gate',
    node_instance_id: null,
    content: {
      mode: 'session_start',
      text: isAdhoc
        ? `准备开始「${group.title}」。可先在输入框填写参数（将作为 #a），再点「通过」启动。`
        : `准备开始「${group.title}」。可先填写说明或项目参数，再点「通过」启动流程。`,
      captureParams: !isAdhoc,
      callArgs: isAdhoc,
      actions: ['approve_start', 'cancel_start'],
      policy: isAdhoc
        ? '通过=开始执行成员；取消=关闭。输入全文记为 #a（调用参数），成员命令里可用 #a / {#a}。'
        : '通过=开始执行流程；取消=关闭本任务。输入可选：多段用空格或换行分隔为 #1、#2…；同会话内递增追加，新开聊另起一套。输出整段不切分。',
    },
  })

  emitAll({ type: 'session.created', payload: { sessionId, groupId } })
  emitSession(sessionId, {
    type: 'gate.request',
    payload: { mode: 'session_start', sessionId, groupTitle: group.title },
  })
  emitSession(sessionId, {
    type: 'session.status',
    payload: { sessionId, status: SESSION_STATUS.WAITING_HUMAN, pendingStart: true },
  })
  // 不自动 advance：等人点「通过」后再跑第一步
  return getSession(sessionId)
}

function findAdhocSessionForMember(memberId) {
  if (!memberId) return null
  const groups = getDb().prepare('SELECT id, config_json FROM groups').all()
  const groupIds = groups
    .filter((g) => {
      const cfg = parseJson(g.config_json, {})
      return cfg?.adhoc === true && cfg?.fromMemberId === memberId
    })
    .map((g) => g.id)
  if (!groupIds.length) return null
  const placeholders = groupIds.map(() => '?').join(',')
  return (
    getDb()
      .prepare(
        `SELECT * FROM sessions WHERE group_id IN (${placeholders})
         ORDER BY CASE WHEN status = 'archived' THEN 1 ELSE 0 END, updated_at DESC
         LIMIT 1`,
      )
      .get(...groupIds) || null
  )
}

function resumeAdhocIfStillPendingStart(sessionId) {
  const session = getSession(sessionId)
  if (!session) return
  const ctx = parseJson(session.context_json, {})
  if (!ctx.pendingStart) return
  delete ctx.pendingStart
  const nextStatus =
    session.status === SESSION_STATUS.ARCHIVED ? SESSION_STATUS.ACTIVE : SESSION_STATUS.ACTIVE
  updateSession(sessionId, {
    status: nextStatus,
    context_json: JSON.stringify(ctx),
  })
  setTimeout(() => {
    advance(sessionId).catch((e) => console.warn('[acw] adhoc resume', e?.message || e))
  }, 0)
}

/**
 * 从单个成员开聊：已有一对一会话则打开它（不新建）。
 * 新会话生成临时「单聊」群模板（config.adhoc），无启动确认闸门。
 */
export function createSessionFromMember(memberId, { title } = {}) {
  const raw = getMember(memberId)
  if (!raw || !raw.enabled) throw new Error('成员不存在或未启用')

  const existing = findAdhocSessionForMember(raw.id)
  if (existing) {
    if (existing.status === SESSION_STATUS.ARCHIVED) {
      unarchiveSession(existing.id, { silent: true, reason: 'member_reuse' })
    }
    resumeAdhocIfStillPendingStart(existing.id)
    const row = getSession(existing.id)
    return row ? { ...row, reused: true } : row
  }

  const name = raw.display_name || raw.name || '成员'
  const t = nowIso()
  const groupId = uid('grp')
  const steps = [
    {
      id: 'step_0',
      type: STEP_TYPE.MEMBER,
      title: name,
      memberId: raw.id,
      gate: false,
      flow: { admin: true, auto: true, human: false },
    },
  ]
  const config = {
    adhoc: true,
    fromMemberId: raw.id,
    admin: { inherit: true, memberId: null, defaultFlow: null },
  }
  getDb()
    .prepare(
      `INSERT INTO groups (id, title, description, work_folder, steps_json, config_json, enabled, cloned_from_id, clone_generation, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, NULL, 0, ?, ?)`,
    )
    .run(
      groupId,
      `单聊 · ${name}`,
      `与成员「${name}」一对一开聊（临时模板，不出现在群列表）`,
      raw.work_folder || null,
      JSON.stringify(steps),
      JSON.stringify(config),
      t,
      t,
    )
  return createSessionFromGroup(groupId, title ? { title } : {})
}

export async function advance(sessionId) {
  const session = getSession(sessionId)
  if (!session) return
  if (session.status === SESSION_STATUS.ARCHIVED) return
  if (session.status === SESSION_STATUS.WAITING_HUMAN) return

  const group = getGroup(session.group_id)
  const steps = parseJson(group.steps_json, [])
  let idx = session.current_step_index

  const maxIndexOf = () => {
    const row = getDb()
      .prepare(`SELECT MAX(step_index) AS m FROM node_instances WHERE session_id = ?`)
      .get(sessionId)
    return row?.m == null ? -1 : Number(row.m)
  }

  while (idx <= maxIndexOf()) {
    const nodes = getDb()
      .prepare('SELECT * FROM node_instances WHERE session_id = ? ORDER BY step_index')
      .all(sessionId)
    const node = nodes.find((n) => n.step_index === idx)
    if (!node) {
      idx += 1
      updateSession(sessionId, { current_step_index: idx })
      continue
    }

    if (node.status === NODE_STATUS.SUCCEEDED || node.status === NODE_STATUS.SKIPPED) {
      idx += 1
      updateSession(sessionId, { current_step_index: idx })
      continue
    }

    if (node.status === NODE_STATUS.WAITING_HUMAN) {
      updateSession(sessionId, { status: SESSION_STATUS.WAITING_HUMAN, current_step_index: idx })
      return
    }

    if (node.status === NODE_STATUS.RUNNING) {
      updateSession(sessionId, { status: SESSION_STATUS.ACTIVE, current_step_index: idx })
      return
    }

    // 旧归档尾节点：静默跳过，不弹闸门、不杀进程
    if (node.step_type === STEP_TYPE.ARCHIVE) {
      skipArchiveNode(sessionId, node, 'completed')
      idx += 1
      updateSession(sessionId, { current_step_index: idx })
      continue
    }

    // 额外节点：可插在流程中间；走到此处则挂起（如中途点外卖），不自动跳过
    if (node.step_type === STEP_TYPE.OFFSITE) {
      const title = node.title || '临时协助'
      persistNodeIo(sessionId, node.id, {
        input: {
          kind: 'offsite',
          prompt: title,
          at: nowIso(),
        },
        output: {
          waiting: true,
          offsiteIdle: false,
          humanAction: 'pending',
          mode: OFFSITE_MODE.PLANNED,
          plannedPause: true,
        },
        status: NODE_STATUS.WAITING_HUMAN,
      })
      updateSession(sessionId, {
        status: SESSION_STATUS.WAITING_HUMAN,
        current_step_index: idx,
      })
      const ctx = parseJson(session.context_json, {})
      ctx.offsiteAssist = {
        active: true,
        nodeInstanceId: node.id,
        at: nowIso(),
        mode: OFFSITE_MODE.PLANNED,
        planned: true,
      }
      updateSession(sessionId, { context_json: JSON.stringify(ctx) })
      addMessage(sessionId, {
        role: 'system',
        type: 'status',
        node_instance_id: node.id,
        content: {
          text: `临时协助「${title}」已挂起。可 @办事；回主线请点右侧正常节点「从这里继续」。`,
          offsite: true,
          mode: OFFSITE_MODE.PLANNED,
        },
      })
      emitSession(sessionId, {
        type: 'session.status',
        payload: {
          sessionId,
          status: SESSION_STATUS.WAITING_HUMAN,
          currentStepIndex: idx,
          offsiteAssist: true,
          nodeInstanceId: node.id,
        },
      })
      return
    }

    // run step
    updateSession(sessionId, { status: SESSION_STATUS.ACTIVE, current_step_index: idx })
    updateNode(node.id, { status: NODE_STATUS.RUNNING, started_at: nowIso() })
    emitSession(sessionId, {
      type: 'session.status',
      payload: { sessionId, status: SESSION_STATUS.ACTIVE, currentStepIndex: idx },
    })

    const { step } = resolveStepForNode(node, steps)
    const ctx = parseJson(session.context_json, {})
    const cloneMeta = (() => {
      const out = parseJson(node.output_json, {})
      const input = parseJson(node.input_json, {})
      if (!out.cloned && !input.cloned) return null
      return {
        cloned: true,
        cloneBatchId: out.cloneBatchId || input.cloneBatchId || null,
        clonedFromNodeInstanceId:
          out.clonedFromNodeInstanceId || input.clonedFromNodeInstanceId || null,
        clonedFromStepIndex:
          out.clonedFromStepIndex ?? input.clonedFromStepIndex ?? null,
      }
    })()

    if (step.type === STEP_TYPE.HUMAN || node.step_type === STEP_TYPE.HUMAN) {
      // 显式 true；显式 false 关闭；未写时仅模板首步默认采集
      const captureParams =
        step.captureParams === true
          ? true
          : step.captureParams === false
            ? false
            : templateStepIndexOf(node, steps.length) === 0
      const basePrompt = step.title || node.title || '请输入 / 确认'
      const prompt = captureParams
        ? `${basePrompt}\n（空格或换行分隔多段 → #1、#2…；同会话内递增追加，不覆盖；新开聊另起一套。节点输出整段不切分）`
        : basePrompt
      persistNodeIo(sessionId, node.id, {
        input: {
          kind: 'human',
          prompt: basePrompt,
          captureParams: !!captureParams,
          ...(cloneMeta || {}),
        },
        output: { waiting: true, ...(cloneMeta || {}) },
        status: NODE_STATUS.WAITING_HUMAN,
      })
      updateSession(sessionId, { status: SESSION_STATUS.WAITING_HUMAN })
      addMessage(sessionId, {
        role: 'system',
        type: 'gate',
        node_instance_id: node.id,
        content: {
          text: prompt,
          mode: 'human_input',
          captureParams: !!captureParams,
          actions: ['submit'],
        },
      })
      emitSession(sessionId, {
        type: 'gate.request',
        payload: {
          nodeInstanceId: node.id,
          mode: 'human_input',
          title: step.title,
          captureParams: !!captureParams,
        },
      })
      return
    }

    // member step
    const member = node.member_id ? getMember(node.member_id) : null
    if (!member) {
      persistNodeIo(sessionId, node.id, {
        input: { memberId: node.member_id },
        output: { error: '成员不存在' },
        status: NODE_STATUS.FAILED,
        finished: true,
      })
      addMessage(sessionId, {
        role: 'system',
        type: 'text',
        node_instance_id: node.id,
        content: { text: `步骤失败：未绑定成员或不存在` },
      })
      dismissPendingArchiveIfAny(sessionId, 'failed')
      return
    }

    if (member.kind === 'script') {
      try {
        const released = killSessionProcesses(sessionId, { includeDetach: false })
        if (released.killed > 0) {
          console.log(
            `[acw] step start: closed ${released.killed} script window(s) before ${member.display_name}`,
          )
        }
      } catch {
        /* ignore */
      }
    }

    if (memberNeedsProjectParams(member) && !hasProjectParam1(ctx)) {
      persistNodeIo(sessionId, node.id, {
        input: {
          memberId: member.id,
          memberName: member.display_name,
          kind: member.kind,
          needParams: true,
        },
        output: {
          needParams: true,
          waiting: true,
          humanAction: 'pending',
          reason: 'missing_param_1',
        },
        status: NODE_STATUS.WAITING_HUMAN,
      })
      updateSession(sessionId, { status: SESSION_STATUS.WAITING_HUMAN })
      addMessage(sessionId, {
        role: 'system',
        type: 'gate',
        node_instance_id: node.id,
        content: {
          text: `「${node.title || member.display_name}」需要项目参数 #1 才能启动。请在输入框提交（空格/换行分段为 #1 #2…），或点「提交」。`,
          mode: 'need_params',
          actions: ['submit'],
          needParams: true,
          policy: '缺 #1 时不启动脚本。闸门重试时本轮输入全文会作为 ACW_HUMAN_INPUT，不强制再切 #1。',
        },
      })
      emitSession(sessionId, {
        type: 'gate.request',
        payload: {
          nodeInstanceId: node.id,
          mode: 'need_params',
          title: node.title,
        },
      })
      return
    }

    const paramsMap = injectCallArgsParam(
      resolveParamsMap(ctx, group),
      ctx.lastHumanInput,
    )
    const memberInput = {
      memberId: member.id,
      memberName: member.display_name,
      kind: member.kind,
      humanInput: ctx.lastHumanInput || paramsMap[SYSTEM_PARAM_KEYS.CALL_ARGS] || null,
      workFolder: ctx.primaryWorkFolder || group?.work_folder || null,
      params: paramsMap,
      paramsList: Array.isArray(ctx.paramsList) ? ctx.paramsList : [],
      groupCard: paramsMap[SYSTEM_PARAM_KEYS.GROUP_CARD] || '',
      groupFolder: paramsMap[SYSTEM_PARAM_KEYS.GROUP_FOLDER] || '',
      callArgs: paramsMap[SYSTEM_PARAM_KEYS.CALL_ARGS] || '',
    }
    persistNodeIo(sessionId, node.id, {
      input: memberInput,
      output: { running: true },
      status: NODE_STATUS.RUNNING,
    })

    addMessage(sessionId, {
      role: 'member',
      member_id: member.id,
      type: 'text',
      node_instance_id: node.id,
      content: { text: `▶ ${member.display_name} 开始执行…` },
    })

    const result = await runMember(member, {
      group,
      sessionContext: {
        ...ctx,
        sessionTitle: session.title,
        params: paramsMap,
      },
      sessionId,
      nodeInstanceId: node.id,
      humanInput: ctx.lastHumanInput || paramsMap[SYSTEM_PARAM_KEYS.CALL_ARGS] || null,
      params: paramsMap,
    })
    // 运行中用户点「归档并关闭进程」时会话可能已归档，勿再推进
    const afterRun = getSession(sessionId)
    if (!afterRun || afterRun.status === SESSION_STATUS.ARCHIVED) {
      return
    }
    persistNodeIo(sessionId, node.id, {
      input: memberInput,
      output: result,
      status: result.ok ? NODE_STATUS.SUCCEEDED : NODE_STATUS.FAILED,
      finished: true,
    })

    // 节点完成：弹窗脚本默认保留黑窗；detach 同理。下一成员步开始时会统一释放。
    if (!result?.detached && !result?.preserveConsole) {
      try {
        const killed = killMemberProcesses(sessionId, member.id)
        if (killed.killed > 0) {
          addMessage(sessionId, {
            role: 'system',
            type: 'status',
            content: {
              text: `节点「${node.title}」已结束（${result.ok ? '成功' : '失败'}），已释放 ${killed.killed} 个进程`,
            },
          })
        }
      } catch {
        /* ignore */
      }
    }

    addMessage(sessionId, {
      role: 'member',
      member_id: member.id,
      type: result.ok ? 'text' : 'text',
      node_instance_id: node.id,
      content: {
        text: result.summary,
        ok: result.ok,
        data: result.data,
      },
    })

    const flow = normalizeStepFlow(step.flow, node.gate || step.gate)
    // 节点结束后刷新群报告；管理员总结闸门另有策略文案
    refreshSessionAnnouncement(sessionId)

    if (!result.ok) {
      // 失败：有人工/管理员通道则等人决断；否则会话自动归档（与成功终局一样释放资源）
      if (flow.human || flow.admin) {
        openFlowGate(sessionId, node, {
          flow,
          failed: true,
          text: [
            `「${node.title}」执行失败。拒绝=不通过；同意可视为放行或重试意图。`,
            result.summary
              ? `\n${String(result.summary).slice(0, 200)}${
                  String(result.summary).length > 200 ? '…' : ''
                }`
              : '',
          ].join(''),
          summary: result.summary,
          votes: { auto: false, human: false, admin: false },
        })
        return
      }
      dismissPendingArchiveIfAny(sessionId, 'failed')
      return
    }

    // —— 成功后的流转策略 ——
    // 审核三态：pending | approve(通过) | reject(拒绝)
    // 脚本产出成功只记 auto 票 + 进入 pending，不默认通过；须点「同意/拒绝」
    // 输入框发消息 / @执行脚本 也保持 pending
    const votes = {
      auto: !!flow.auto,
      human: false,
      admin: false,
    }

    if (flow.human || flow.admin || flow.auto) {
      const bits = []
      if (flow.human) bits.push('须人工同意')
      if (flow.admin) bits.push('可管理员确认')
      if (flow.auto) bits.push('已记自动产出票')
      openFlowGate(sessionId, node, {
        flow,
        failed: false,
        text: `「${node.title}」已产出，审核中（pending）。${bits.join('；')}。输入或再跑脚本不会自动通过/拒绝。`,
        summary: result.summary,
        votes,
        requireHuman: !!flow.human,
        requireAdmin: !!flow.admin && !flow.human,
      })
      return
    }

    // 三项全关：默认直接流转，避免卡死
    idx += 1
    updateSession(sessionId, { current_step_index: idx })
  }

  // 全部步骤完成：保持会话进行中，常驻终端不回收；到设置里释放资源
  refreshSessionAnnouncement(sessionId)
  dismissPendingArchiveIfAny(sessionId, 'completed')
}

/**
 * 兼容旧调用名：不再弹归档闸门、不杀进程。
 */
export function requestArchiveConsent(sessionId, reason = 'completed') {
  return dismissPendingArchiveIfAny(sessionId, reason)
}

/**
 * 不再按超时自动归档。顺手清掉旧的待确认归档闸门。
 * @returns {{ archived: string[], dismissed: string[] }}
 */
export function processDueArchives() {
  const rows = getDb()
    .prepare(`SELECT * FROM sessions WHERE status != ? AND status != ?`)
    .all(SESSION_STATUS.ARCHIVED, SESSION_STATUS.INTERRUPTED)
  const dismissed = []
  for (const row of rows) {
    const ctx = parseJson(row.context_json, {})
    const waitingArch = getDb()
      .prepare(
        `SELECT id FROM node_instances WHERE session_id = ? AND step_type = ? AND status = ?`,
      )
      .get(row.id, STEP_TYPE.ARCHIVE, NODE_STATUS.WAITING_HUMAN)
    if (!ctx.pendingArchive && !waitingArch) continue
    try {
      dismissPendingArchiveIfAny(row.id, ctx.pendingArchive?.reason || 'completed')
      dismissed.push(row.id)
    } catch (e) {
      console.warn('[acw] dismiss pending archive failed', row.id, e.message)
    }
  }
  return { archived: [], dismissed }
}

/**
 * 刷新群报告 MD（# 参数 + 各节点 I/O）
 * 写入 journals/sessions/{id}/ANNOUNCEMENT.md，并记入 context.announcementPath
 */
/**
 * @param {string} sessionId
 * @param {{ modes?: string[], force?: boolean }} [opts]
 *   force=true 覆盖人工编辑；默认若 announcementManual 则跳过自动生成
 */
export function refreshSessionAnnouncement(sessionId, opts = {}) {
  try {
    const session = getSession(sessionId)
    if (!session) return null
    const ctx = parseJson(session.context_json, {})
    // 人工改过的公告：自动刷新不覆盖，除非 force
    if (ctx.announcementManual && !opts.force) {
      const existing = readSessionAnnouncement(sessionId)
      return existing
        ? { rel: existing.rel, markdown: existing.markdown, modes: ctx.announcementModes, skipped: true }
        : null
    }
    const nodes = getDb()
      .prepare('SELECT * FROM node_instances WHERE session_id = ? ORDER BY step_index')
      .all(sessionId)
      .map((n) => {
        let memberName = ''
        if (n.member_id) {
          const m = getMember(n.member_id)
          memberName = m?.display_name || m?.name || ''
        }
        return {
          ...n,
          memberName,
          input: parseJson(n.input_json, null),
          output: parseJson(n.output_json, null),
          journal_path: n.journal_path,
          journalPath: n.journal_path,
        }
      })
    const adminName = ctx.admin?.memberName || ''
    // 维护实质入出（含用户附言 / 脚本产出），不是开始结束空话
    const modes = opts.modes || ['io']
    const { rel, markdown, modes: usedModes } = writeSessionAnnouncement({
      sessionId,
      sessionTitle: session.title,
      status: session.status,
      nodes,
      adminName,
      paramsList: ctx.paramsList,
      params: ctx.params,
      groupCard: ctx.groupCard || ctx.params?.['#群聊'] || '',
      groupFolder: ctx.groupFolder || ctx.params?.['#文件夹'] || '',
      modes,
      kickoff: ctx.kickoff || null,
      userNotes: ctx.userNotes || [],
    })
    ctx.announcementPath = rel
    ctx.announcementUpdatedAt = new Date().toISOString()
    ctx.announcementManual = false
    ctx.announcementModes = usedModes || ['concise']
    updateSession(sessionId, { context_json: JSON.stringify(ctx) })
    emitSession(sessionId, {
      type: 'announcement.updated',
      payload: { sessionId, path: rel, modes: usedModes, manual: false },
    })
    return { rel, markdown, modes: usedModes }
  } catch (e) {
    console.warn('[acw] announcement write failed', e.message)
    return null
  }
}

/** 人工保存群报告正文（可随时改 MD） */
export function saveSessionAnnouncement(sessionId, markdown) {
  const session = getSession(sessionId)
  if (!session) throw new Error('会话不存在')
  const { rel, markdown: body } = saveSessionAnnouncementRaw(sessionId, markdown)
  const ctx = parseJson(session.context_json, {})
  ctx.announcementPath = rel
  ctx.announcementUpdatedAt = new Date().toISOString()
  ctx.announcementManual = true
  updateSession(sessionId, { context_json: JSON.stringify(ctx) })
  emitSession(sessionId, {
    type: 'announcement.updated',
    payload: { sessionId, path: rel, manual: true },
  })
  // 聊天里留一条系统提示（可选、轻量）
  addMessage(sessionId, {
    role: 'system',
    type: 'status',
    content: { text: '群报告已由人工更新', announcement: true },
  })
  return { rel, markdown: body, manual: true }
}

/** 打开流转闸门（人工/管理员）；审核态先置 pending */
function openFlowGate(sessionId, node, payload) {
  updateNode(node.id, { status: NODE_STATUS.WAITING_HUMAN })
  updateSession(sessionId, { status: SESSION_STATUS.WAITING_HUMAN })
  // 把 flow/votes 记在节点 output，便于同意时合并
  const prev = parseJson(node.output_json, {})
  updateNode(node.id, {
    status: NODE_STATUS.WAITING_HUMAN,
    output_json: JSON.stringify({
      ...prev,
      flow: payload.flow,
      votes: payload.votes || {},
      requireHuman: !!payload.requireHuman,
      requireAdmin: !!payload.requireAdmin,
      failed: !!payload.failed,
      summary: payload.summary,
      /** pending | approve | reject；脚本/输入不改此态，仅同意/拒绝按钮改 */
      humanAction: 'pending',
    }),
  })
  addMessage(sessionId, {
    role: 'system',
    type: 'gate',
    node_instance_id: node.id,
    content: {
      text: payload.text,
      mode: 'gate',
      actions: ['approve', 'reject'],
      flow: payload.flow,
      requireHuman: !!payload.requireHuman,
      requireAdmin: !!payload.requireAdmin,
      failed: !!payload.failed,
      summary: payload.summary,
      humanAction: 'pending',
      policy:
        '审核三态：pending（待定）/ 通过 / 拒绝。输入框发消息或执行脚本保持 pending；须点「同意」才通过、「拒绝」才不通过。',
    },
  })
  // 管理员总结与流转：闸门打开后刷新群报告 MD
  if (payload.flow?.admin || payload.requireAdmin) {
    refreshSessionAnnouncement(sessionId)
  }
  emitSession(sessionId, {
    type: 'gate.request',
    payload: {
      nodeInstanceId: node.id,
      mode: 'gate',
      title: node.title,
      flow: payload.flow,
    },
  })
}

export function archiveSession(sessionId, reason = 'manual') {
  // 归档 = 结束本会话全部进程（bat 黑窗 / Start-Process 目标 / HTA 监控窗 / 静默子进程）
  let killed = { killed: 0, pids: [] }
  try {
    killed = killSessionProcesses(sessionId)
    // 再扫一次磁盘 pid 清单，防止漏登
    const again = killSessionProcesses(sessionId)
    if (again.killed > 0) {
      killed = {
        killed: killed.killed + again.killed,
        pids: [...(killed.pids || []), ...(again.pids || [])],
      }
    }
  } catch (e) {
    console.warn('[acw] archive kill processes failed', sessionId, e?.message || e)
  }
  const t = nowIso()
  const s0 = getSession(sessionId)
  const ctx0 = parseJson(s0?.context_json, {})
  delete ctx0.pendingArchive
  // 归档 = 释放资源；未执行节点状态保留，流程轨默认仍可查看
  if (ctx0.offsiteAssist) {
    ctx0.offsiteAssist = { ...ctx0.offsiteAssist, active: false, archivedAt: t }
  }
  try {
    const off = getDb()
      .prepare(
        `SELECT * FROM node_instances WHERE session_id = ? AND step_type = ? LIMIT 1`,
      )
      .get(sessionId, STEP_TYPE.OFFSITE)
    if (off && (off.status === NODE_STATUS.RUNNING || off.status === NODE_STATUS.WAITING_HUMAN)) {
      const prev = parseJson(off.output_json, {})
      updateNode(off.id, {
        status: NODE_STATUS.PENDING,
        output_json: JSON.stringify({ ...prev, archivedIdle: true }),
        finished_at: t,
      })
    }
  } catch {
    /* ignore */
  }
  if (ctx0.interrupted) {
    ctx0.interrupted = {
      ...ctx0.interrupted,
      pendingResume: false,
      resolvedAt: t,
      resolution: reason,
    }
  }
  try {
    markArchiveNodeDone(sessionId, { reason })
  } catch {
    /* ignore */
  }
  updateSession(sessionId, {
    status: SESSION_STATUS.ARCHIVED,
    archive_reason: reason,
    archived_at: t,
    context_json: JSON.stringify(ctx0),
  })
  if (killed.killed > 0) {
    try {
      addMessage(sessionId, {
        role: 'system',
        type: 'status',
        content: {
          text: `已归档：已请求结束 ${killed.killed} 个进程（PID: ${killed.pids.join(', ')}）并放开目录。外部窗口若仍在请手关。本会话仍在，可恢复续聊或「从这里继续」；可再次归档。`,
        },
      })
    } catch {
      /* ignore */
    }
  } else {
    try {
      addMessage(sessionId, {
        role: 'system',
        type: 'status',
        content: {
          text: '已归档：已请求释放进程并放开目录。本会话仍在，可恢复续聊或「从这里继续」；可再次归档。外部窗口若仍在请手关。',
        },
      })
    } catch {
      /* ignore */
    }
  }
  emitSession(sessionId, {
    type: 'session.archived',
    payload: { sessionId, reason, processesKilled: killed.killed, pids: killed.pids },
  })
  emitAll({
    type: 'session.archived',
    payload: { sessionId, reason, processesKilled: killed.killed },
  })

  // 归档后写会话 MD 索引（节点台账汇总）
  try {
    const s = getSession(sessionId)
    const nodes = getDb()
      .prepare('SELECT * FROM node_instances WHERE session_id = ? ORDER BY step_index')
      .all(sessionId)
    writeSessionJournalIndex({
      sessionId,
      sessionTitle: s?.title,
      status: s?.status,
      nodes,
    })
  } catch (e) {
    console.warn('[acw] session journal index failed', e.message)
  }
}

/**
 * R02：启动时标记崩溃恢复（未归档的进行中会话 → interrupted）
 */
export function markInterruptedOnBoot() {
  const rows = getDb()
    .prepare(
      `SELECT * FROM sessions WHERE status IN ('active', 'waiting_human', 'paused')`,
    )
    .all()
  const ids = []
  for (const s of rows) {
    try {
      killSessionProcesses(s.id)
    } catch (e) {
      console.warn('[acw] interrupt kill', s.id, e?.message || e)
    }
    const running = getDb()
      .prepare(`SELECT * FROM node_instances WHERE session_id = ? AND status = ?`)
      .all(s.id, NODE_STATUS.RUNNING)
    for (const n of running) {
      const prev = parseJson(n.output_json, {})
      updateNode(n.id, {
        status: NODE_STATUS.WAITING_HUMAN,
        output_json: JSON.stringify({
          ...prev,
          interrupted: true,
          interruptedAt: nowIso(),
          wasRunning: true,
        }),
      })
    }
    const ctx = parseJson(s.context_json, {})
    ctx.interrupted = {
      at: nowIso(),
      previousStatus: s.status,
      pendingResume: true,
      runningNodes: running.map((n) => n.id),
    }
    updateSession(s.id, {
      status: SESSION_STATUS.INTERRUPTED,
      context_json: JSON.stringify(ctx),
    })
    addMessage(s.id, {
      role: 'system',
      type: 'status',
      content: {
        text: '检测到服务重启或异常退出，本任务已暂停。请选择：继续 / 放弃。进程可在设置里释放。',
      },
    })
    addMessage(s.id, {
      role: 'system',
      type: 'gate',
      content: {
        mode: 'interrupted',
        text: `会话「${s.title || s.id}」在重启前处于「${s.status}」。继续=从中断处恢复；放弃=跳过未跑完的步骤（不杀进程，可到设置释放资源）。`,
        actions: ['resume_interrupted', 'discard_interrupted'],
        policy: '不会自动推进；须人工选择。继续时若有未完成 running 节点会从该步重跑。释放进程请到设置。',
      },
    })
    emitSession(s.id, {
      type: 'session.interrupted',
      payload: { sessionId: s.id, previousStatus: s.status },
    })
    ids.push(s.id)
  }
  if (ids.length) {
    emitAll({ type: 'sessions.interrupted', payload: { ids } })
    console.log(`[acw] interrupted ${ids.length} session(s) for recovery`)
  }
  // 已归档会话：清掉残留 console pid 文件，避免误报占用
  try {
    const archived = getDb()
      .prepare(`SELECT id FROM sessions WHERE status = ?`)
      .all(SESSION_STATUS.ARCHIVED)
      .map((r) => r.id)
    const cleaned = cleanupArchivedSessionPidFiles(archived)
    if (cleaned.cleared) {
      console.log(`[acw] cleared pid files for ${cleaned.cleared} archived session(s)`)
    }
  } catch (e) {
    console.warn('[acw] cleanup archived pid files', e?.message || e)
  }
  return { marked: ids.length, ids }
}

/**
 * R02：处理 interrupted 闸门
 * @param {'resume'|'archive'|'discard'|string} action
 */
export async function resolveInterruptedSession(sessionId, action) {
  const session = getSession(sessionId)
  if (!session) throw new Error('会话不存在')
  if (session.status !== SESSION_STATUS.INTERRUPTED) {
    throw Object.assign(new Error('会话不在中断恢复状态'), { code: 'NOT_INTERRUPTED' })
  }
  const act = String(action || '')
    .replace(/^resume_interrupted$/, 'resume')
    .replace(/^archive_interrupted$/, 'archive')
    .replace(/^discard_interrupted$/, 'discard')

  if (act === 'archive' || act === 'discard') {
    addMessage(sessionId, {
      role: 'user',
      type: 'gate',
      content: {
        text: '已选择放弃（中断恢复）',
        action: 'discard_interrupted',
        mode: 'interrupted',
      },
    })
    const db = getDb()
    const nodes = db
      .prepare(`SELECT * FROM node_instances WHERE session_id = ? ORDER BY step_index`)
      .all(sessionId)
    for (const n of nodes) {
      if (n.step_type === STEP_TYPE.ARCHIVE) {
        skipArchiveNode(sessionId, n, 'interrupted_discard')
        continue
      }
      if (
        n.status === NODE_STATUS.PENDING ||
        n.status === NODE_STATUS.RUNNING ||
        n.status === NODE_STATUS.WAITING_HUMAN
      ) {
        persistNodeIo(sessionId, n.id, {
          input: parseJson(n.input_json, {}),
          output: {
            ...parseJson(n.output_json, {}),
            skipped: true,
            skipReason: 'interrupted_discard',
          },
          status: NODE_STATUS.SKIPPED,
          finished: true,
        })
      }
    }
    const ctx = parseJson(session.context_json, {})
    ctx.interrupted = {
      ...(ctx.interrupted || {}),
      pendingResume: false,
      resolvedAt: nowIso(),
      resolution: 'discard',
    }
    delete ctx.pendingArchive
    updateSession(sessionId, {
      status: SESSION_STATUS.FAILED,
      context_json: JSON.stringify(ctx),
    })
    addMessage(sessionId, {
      role: 'system',
      type: 'status',
      content: {
        text: '已放弃未完成步骤。占用的进程不会自动结束，请到设置里释放资源。',
      },
    })
    return { ok: true, archived: false, discarded: true, action: 'discard' }
  }

  if (act !== 'resume') {
    throw new Error(`未知恢复动作: ${action}`)
  }

  const ctx = parseJson(session.context_json, {})
  const prevStatus = ctx.interrupted?.previousStatus || SESSION_STATUS.ACTIVE
  ctx.interrupted = {
    ...(ctx.interrupted || {}),
    pendingResume: false,
    resolvedAt: nowIso(),
    resolution: 'resume',
  }

  addMessage(sessionId, {
    role: 'user',
    type: 'gate',
    content: {
      text: '已选择继续（中断恢复）',
      action: 'resume_interrupted',
      mode: 'interrupted',
    },
  })

  // 曾 running 的节点：置 pending，从该步 advance
  const nodes = getDb()
    .prepare(`SELECT * FROM node_instances WHERE session_id = ? ORDER BY step_index`)
    .all(sessionId)
  const interruptedNode = nodes.find((n) => parseJson(n.output_json, {})?.interrupted === true)
  if (interruptedNode) {
    updateNode(interruptedNode.id, {
      status: NODE_STATUS.PENDING,
      output_json: JSON.stringify({
        ...parseJson(interruptedNode.output_json, {}),
        interrupted: false,
        resumedAt: nowIso(),
      }),
      finished_at: null,
    })
    // 该步之后若曾误推进，保持其后 pending
    updateSession(sessionId, {
      status: SESSION_STATUS.ACTIVE,
      current_step_index: interruptedNode.step_index,
      context_json: JSON.stringify(ctx),
    })
    addMessage(sessionId, {
      role: 'system',
      type: 'status',
      content: { text: `从中断节点「${interruptedNode.title}」继续执行…` },
    })
    setImmediate(() => advance(sessionId).catch(console.error))
    return { ok: true, resumed: true, fromNode: interruptedNode.id }
  }

  if (ctx.pendingStart) {
    updateSession(sessionId, {
      status: SESSION_STATUS.WAITING_HUMAN,
      context_json: JSON.stringify(ctx),
    })
    addMessage(sessionId, {
      role: 'system',
      type: 'status',
      content: { text: '已恢复到开聊确认，请继续操作。' },
    })
    return { ok: true, resumed: true, pendingStart: true }
  }

  if (ctx.pendingArchive) {
    delete ctx.pendingArchive
  }

  const waiting = nodes.find((n) => n.status === NODE_STATUS.WAITING_HUMAN)
  if (waiting || prevStatus === SESSION_STATUS.WAITING_HUMAN) {
    updateSession(sessionId, {
      status: SESSION_STATUS.WAITING_HUMAN,
      context_json: JSON.stringify(ctx),
    })
    addMessage(sessionId, {
      role: 'system',
      type: 'status',
      content: { text: '已恢复到待确认，请继续操作。' },
    })
    return { ok: true, resumed: true, waitingHuman: true }
  }

  updateSession(sessionId, {
    status: SESSION_STATUS.ACTIVE,
    context_json: JSON.stringify(ctx),
  })
  addMessage(sessionId, {
    role: 'system',
    type: 'status',
    content: { text: '已恢复，继续推进流程…' },
  })
  setImmediate(() => advance(sessionId).catch(console.error))
  return { ok: true, resumed: true }
}

export async function handleGateAction(sessionId, { action, text, nodeInstanceId, idempotencyKey, questionId, choice }) {
  const session = getSession(sessionId)
  if (!session) throw new Error('会话不存在')
  if (session.status === SESSION_STATUS.ARCHIVED) {
    throw Object.assign(new Error('任务已归档'), { code: 'ARCHIVED' })
  }

  // R02：中断恢复闸门（优先于其它动作）
  const isInterruptAction =
    action === 'resume_interrupted' ||
    action === 'archive_interrupted' ||
    action === 'discard_interrupted' ||
    action === 'resume' ||
    action === 'discard'
  if (session.status === SESSION_STATUS.INTERRUPTED || isInterruptAction) {
    if (session.status !== SESSION_STATUS.INTERRUPTED && !isInterruptAction) {
      throw Object.assign(new Error('会话已中断，请先选择继续或放弃'), {
        code: 'INTERRUPTED',
      })
    }
    if (
      session.status === SESSION_STATUS.INTERRUPTED &&
      !(
        action === 'resume_interrupted' ||
        action === 'archive_interrupted' ||
        action === 'discard_interrupted' ||
        action === 'resume' ||
        action === 'archive' ||
        action === 'discard'
      )
    ) {
      throw Object.assign(new Error('会话已中断，请先选择继续或放弃'), {
        code: 'INTERRUPTED',
      })
    }
  }

  // R03：幂等键命中则直接回放，避免连点双跑
  const idemKey =
    idempotencyKey != null && String(idempotencyKey).trim()
      ? String(idempotencyKey).trim().slice(0, 120)
      : ''
  if (idemKey) {
    const cached = readGateIdempotency(sessionId, idemKey)
    if (cached?.result) {
      return { ...cached.result, idempotentReplay: true }
    }
  }

  if (
    action === 'resume_interrupted' ||
    action === 'archive_interrupted' ||
    action === 'discard_interrupted' ||
    (session.status === SESSION_STATUS.INTERRUPTED &&
      (action === 'resume' || action === 'archive' || action === 'discard'))
  ) {
    const result = await resolveInterruptedSession(sessionId, action)
    if (idemKey) rememberGateIdempotency(sessionId, idemKey, result || { ok: true, action })
    return result
  }

  const result = await handleGateActionCore(sessionId, {
    action,
    text,
    nodeInstanceId,
    questionId,
    choice,
  })
  if (idemKey) {
    rememberGateIdempotency(sessionId, idemKey, result || { ok: true, action })
  }
  return result
}

async function handleGateActionCore(sessionId, { action, text, nodeInstanceId, questionId, choice }) {
  const session = getSession(sessionId)
  if (!session) throw new Error('会话不存在')
  if (session.status === SESSION_STATUS.ARCHIVED) {
    throw Object.assign(new Error('任务已归档'), { code: 'ARCHIVED' })
  }
  if (session.status === SESSION_STATUS.INTERRUPTED) {
    throw Object.assign(new Error('会话已中断，请先选择继续或放弃'), {
      code: 'INTERRUPTED',
    })
  }

  if (action === 'adapter_answer' || questionId) {
    return answerAdapterQuestion(sessionId, {
      questionId,
      text,
      choice,
      action,
    })
  }

  // —— 开聊启动闸门（无节点，context.pendingStart）——
  {
    const ctxStart = parseJson(session.context_json, {})
    const pendingStart = ctxStart.pendingStart
    const isStartAction =
      action === 'approve_start' ||
      action === 'cancel_start' ||
      (!!pendingStart &&
        !nodeInstanceId &&
        (action === 'approve' ||
          action === 'reject' ||
          action === 'submit' ||
          action === 'human_submit'))
    if (isStartAction) {
      if (!pendingStart) throw new Error('当前没有待确认的启动')
      if (action === 'cancel_start' || action === 'reject') {
        delete ctxStart.pendingStart
        updateSession(sessionId, {
          context_json: JSON.stringify(ctxStart),
        })
        addMessage(sessionId, {
          role: 'user',
          type: 'gate',
          content: { text: '已取消启动', action: 'cancel_start', mode: 'session_start' },
        })
        addMessage(sessionId, {
          role: 'system',
          type: 'status',
          content: { text: '未启动流程，任务已关闭' },
        })
        archiveSession(sessionId, 'start_cancelled')
        return { cancelled: true }
      }

      // 通过：写入可选输入/参数，再 advance
      const inputText = text != null ? String(text) : ''
      const callArgsOnly = !!pendingStart.callArgs || pendingStart.captureParams === false
      delete ctxStart.pendingStart
      ctxStart.lastHumanInput = inputText
      ctxStart.kickoff = { text: inputText, at: nowIso() }
      if (inputText.trim()) {
        ctxStart.userNotes = Array.isArray(ctxStart.userNotes) ? ctxStart.userNotes : []
        ctxStart.userNotes.push({
          at: nowIso(),
          action: 'approve_start',
          actionLabel: '启动',
          text: inputText.trim(),
          nodeTitle: '开聊确认',
        })
      }

      // #a = 启动时输入框全文（成员单聊 / 调用参数）
      ctxStart.params = {
        ...(ctxStart.params && typeof ctxStart.params === 'object' ? ctxStart.params : {}),
        [SYSTEM_PARAM_KEYS.CALL_ARGS]: inputText.trim(),
      }

      let parsed = null
      if (inputText.trim() && !callArgsOnly) {
        // 同会话递增追加（开聊一般为首次，等价于从 #1 起）
        parsed = appendProjectParams(ctxStart, inputText)
        ctxStart.projectInfoRaw = [ctxStart.projectInfoRaw, parsed.raw]
          .filter((s) => s != null && String(s).trim())
          .join('\n')
        ctxStart.paramsList = parsed.list
        const group = getGroup(session.group_id)
        const steps = parseJson(group?.steps_json, [])
        const gObj = { ...group, steps }
        const sysCard =
          ctxStart.params?.[SYSTEM_PARAM_KEYS.GROUP_CARD] ||
          ctxStart.groupCard ||
          formatGroupCard(gObj, {
            memberNameOf: (id) => {
              const m = getMember(id)
              return m?.display_name || m?.name || id
            },
          })
        ctxStart.groupCard = sysCard
        ctxStart.groupFolder = resolveGroupFolder(gObj, ctxStart)
        ctxStart.params = mergeSystemParams(
          {
            ...parsed.map,
            [SYSTEM_PARAM_KEYS.CALL_ARGS]: inputText.trim(),
          },
          {
            group: gObj,
            sessionContext: ctxStart,
            memberNameOf: (id) => {
              const m = getMember(id)
              return m?.display_name || m?.name || id
            },
          },
        )
      } else if (inputText.trim() && callArgsOnly) {
        // #a 已写入 params，下方统一发启动状态
      }

      const autoTitleStart = syncAutoSessionTitle(ctxStart, getGroup(session.group_id))
      updateSession(sessionId, {
        status: SESSION_STATUS.ACTIVE,
        context_json: JSON.stringify(ctxStart),
        ...(autoTitleStart ? { title: autoTitleStart } : {}),
      })

      addMessage(sessionId, {
        role: 'user',
        type: 'gate',
        content: {
          text: inputText.trim() ? `已通过并开始：${inputText.trim()}` : '已通过，开始执行',
          action: 'approve_start',
          mode: 'session_start',
          params: parsed?.map || undefined,
        },
      })
      if (parsed?.list?.length) {
        addMessage(sessionId, {
          role: 'system',
          type: 'status',
          content: {
            text: `已写入项目参数：${formatAddedParamsText(parsed.added, parsed.startIndex)}`,
            params: parsed.map,
            paramsList: parsed.list,
          },
        })
      } else if (inputText.trim() && callArgsOnly) {
        addMessage(sessionId, {
          role: 'system',
          type: 'status',
          content: {
            text: `已写入调用参数 #a，开始执行…`,
            params: { [SYSTEM_PARAM_KEYS.CALL_ARGS]: inputText.trim() },
          },
        })
      } else {
        addMessage(sessionId, {
          role: 'system',
          type: 'status',
          content: { text: '已确认启动，开始执行流程…' },
        })
      }

      refreshSessionAnnouncement(sessionId)
      emitSession(sessionId, {
        type: 'session.status',
        payload: { sessionId, status: SESSION_STATUS.ACTIVE, pendingStart: false },
      })
      setImmediate(() => advance(sessionId).catch(console.error))
      return { started: true, session: getSession(sessionId) }
    }
  }

  // —— 归档确认闸门（绑定末尾归档节点，context.pendingArchive）——
  {
    const ctxArch = parseJson(session.context_json, {})
    const pending = ctxArch.pendingArchive
    const isArchiveAction =
      action === 'approve_archive' ||
      action === 'defer_archive' ||
      (!!pending &&
        (!nodeInstanceId ||
          nodeInstanceId === pending.nodeInstanceId ||
          (() => {
            const n = nodeInstanceId
              ? getDb()
                  .prepare('SELECT step_type FROM node_instances WHERE id = ?')
                  .get(nodeInstanceId)
              : null
            return n?.step_type === STEP_TYPE.ARCHIVE
          })()) &&
        (action === 'approve' || action === 'reject'))
    if (isArchiveAction) {
      if (!pending) throw new Error('当前没有待确认的归档')
      const archNote = text != null ? String(text).trim() : ''
      if (action === 'defer_archive' || action === 'reject') {
        addMessage(sessionId, {
          role: 'user',
          type: 'gate',
          content: {
            text: archNote ? `暂不归档：${archNote}` : '暂不归档',
            action: 'defer_archive',
            mode: 'archive_confirm',
            note: archNote || undefined,
          },
        })
        if (archNote) {
          const c = parseJson(session.context_json, {})
          c.userNotes = Array.isArray(c.userNotes) ? c.userNotes : []
          c.userNotes.push({
            at: nowIso(),
            action: 'defer_archive',
            actionLabel: '暂不归档',
            text: archNote,
          })
          updateSession(sessionId, { context_json: JSON.stringify(c) })
        }
        addMessage(sessionId, {
          role: 'system',
          type: 'status',
          content: {
            text: pending.dueAt
              ? `已记录暂不归档；若至 ${pending.dueAt} 仍未确认，系统将自动归档。`
              : '已记录暂不归档。',
          },
        })
        refreshSessionAnnouncement(sessionId)
        return { deferred: true, pendingArchive: pending }
      }
      addMessage(sessionId, {
        role: 'user',
        type: 'gate',
        content: {
          text: archNote ? `已同意归档：${archNote}` : '已同意归档',
          action: 'approve_archive',
          mode: 'archive_confirm',
          note: archNote || undefined,
        },
      })
      if (archNote) {
        const c = parseJson(session.context_json, {})
        c.userNotes = Array.isArray(c.userNotes) ? c.userNotes : []
        c.userNotes.push({
          at: nowIso(),
          action: 'approve_archive',
          actionLabel: '同意归档',
          text: archNote,
        })
        c.lastHumanInput = archNote
        updateSession(sessionId, { context_json: JSON.stringify(c) })
      }
      refreshSessionAnnouncement(sessionId)
      const reason = pending.reason || 'manual'
      archiveSession(
        sessionId,
        reason === 'completed' ? 'completed_confirmed' : reason,
      )
      return { archived: true }
    }
  }

  const node = nodeInstanceId
    ? getDb()
        .prepare('SELECT * FROM node_instances WHERE id = ? AND session_id = ?')
        .get(nodeInstanceId, sessionId)
    : null
  if (!node) throw new Error('节点不存在')

  // 闸门推进主线 = 回归正轨：场外默认完成并归档
  if (
    action === 'submit' ||
    action === 'human_submit' ||
    action === 'approve' ||
    action === 'admin_approve' ||
    action === 'reject'
  ) {
    archiveOffsiteOnReturnToMain(sessionId, {
      reason: 'gate_progress',
      resumeTitle: node.title || `步骤 ${Number(node.step_index) + 1}`,
      resumeNodeId: node.id,
      resumeStepIndex: Number(node.step_index),
      silent: false,
    })
  }

  if (action === 'submit' || action === 'human_submit') {
    if (node.status !== NODE_STATUS.WAITING_HUMAN) {
      throw Object.assign(new Error('当前节点不在等待输入状态'), { code: 'NOT_WAITING' })
    }
    const prevOut = parseJson(node.output_json, {})
    const ctx = parseJson(session.context_json, {})
    const fullText = text != null ? String(text) : ''
    // 纯 @成员：不当闸门提交（应走发消息协助）
    {
      const enabledMembers = getDb()
        .prepare('SELECT * FROM members WHERE enabled = 1')
        .all()
      if (isMentionAssistOnly(fullText, enabledMembers)) {
        throw Object.assign(
          new Error('纯 @ 提及请用发送消息协助，不能作为闸门/项目参数提交'),
          { code: 'MENTION_ASSIST_ONLY' },
        )
      }
    }
    ctx.lastHumanInput = fullText
    ctx.workFolderReason = ctx.workFolderReason || 'user'

    const group = getGroup(session.group_id)
    const steps = parseJson(group?.steps_json, [])
    const { step } = resolveStepForNode(node, steps)
    const prevIn = parseJson(node.input_json, {})

    // CI01：缺 #1 拦截后的补参提交 → 写入参数后从本步重跑（不前进 step_index）
    if (prevOut.needParams || (node.step_type === STEP_TYPE.MEMBER && prevOut.reason === 'missing_param_1')) {
      if (!fullText.trim()) {
        throw Object.assign(new Error('请先输入项目参数 #1（空格/换行可分段）'), {
          code: 'NEED_PARAMS',
        })
      }
      const parsed = appendProjectParams(ctx, fullText)
      ctx.projectInfoRaw = [ctx.projectInfoRaw, parsed.raw]
        .filter((s) => s != null && String(s).trim())
        .join('\n')
      ctx.paramsList = parsed.list
      const gObj = { ...group, steps }
      const sysCard =
        ctx.params?.[SYSTEM_PARAM_KEYS.GROUP_CARD] ||
        ctx.groupCard ||
        formatGroupCard(gObj, {
          memberNameOf: (id) => {
            const m = getMember(id)
            return m?.display_name || m?.name || id
          },
        })
      ctx.groupCard = sysCard
      ctx.groupFolder = resolveGroupFolder(gObj, ctx)
      ctx.params = mergeSystemParams(
        {
          ...parsed.map,
          [SYSTEM_PARAM_KEYS.CALL_ARGS]: fullText.trim(),
        },
        {
          group: gObj,
          sessionContext: ctx,
          memberNameOf: (id) => {
            const m = getMember(id)
            return m?.display_name || m?.name || id
          },
        },
      )
      const autoTitleNeed = syncAutoSessionTitle(ctx, group)
      updateSession(sessionId, {
        context_json: JSON.stringify(ctx),
        status: SESSION_STATUS.ACTIVE,
        current_step_index: node.step_index,
        ...(autoTitleNeed ? { title: autoTitleNeed } : {}),
      })
      persistNodeIo(sessionId, node.id, {
        input: {
          ...prevIn,
          submitted: fullText,
          needParams: true,
        },
        output: {
          needParams: false,
          params: parsed.map,
          paramsList: parsed.list,
          humanAction: 'pending',
        },
        status: NODE_STATUS.PENDING,
      })
      addMessage(sessionId, {
        role: 'user',
        type: 'text',
        node_instance_id: node.id,
        content: { text: fullText, params: parsed.map },
      })
      addMessage(sessionId, {
        role: 'system',
        type: 'status',
        content: {
          text: `已补齐项目参数：${formatAddedParamsText(parsed.added, parsed.startIndex)}，继续执行本步`,
          paramsList: parsed.list,
        },
      })
      refreshSessionAnnouncement(sessionId)
      setImmediate(() => advance(sessionId).catch(console.error))
      return { ok: true, needParamsFilled: true }
    }

    // human input step
    // 采集项目参数：步骤显式 captureParams，或模板首个人工步默认开启
    const tplIdx = templateStepIndexOf(node, steps.length)
    const captureParams =
      prevIn.captureParams === true ||
      step.captureParams === true ||
      (step.captureParams !== false && tplIdx === 0)

    let parsed = null
    if (captureParams) {
      // 同会话内追加：开聊已写 #1 时，本步再输入 → #2…，不覆盖
      parsed = appendProjectParams(ctx, fullText)
      ctx.projectInfoRaw = [ctx.projectInfoRaw, parsed.raw]
        .filter((s) => s != null && String(s).trim())
        .join('\n')
      ctx.paramsList = parsed.list
      // 保留系统 #群聊 / #文件夹，合并用户 #1 #2…
      const gObj = { ...group, steps }
      const sysCard =
        ctx.params?.[SYSTEM_PARAM_KEYS.GROUP_CARD] ||
        ctx.groupCard ||
        formatGroupCard(gObj, {
          memberNameOf: (id) => {
            const m = getMember(id)
            return m?.display_name || m?.name || id
          },
        })
      ctx.groupCard = sysCard
      ctx.groupFolder = resolveGroupFolder(gObj, ctx)
      ctx.params = mergeSystemParams(parsed.map, {
        group: gObj,
        sessionContext: ctx,
        memberNameOf: (id) => {
          const m = getMember(id)
          return m?.display_name || m?.name || id
        },
      })
    }

    const autoTitleHuman = syncAutoSessionTitle(ctx, group)
    updateSession(sessionId, {
      context_json: JSON.stringify(ctx),
      status: SESSION_STATUS.ACTIVE,
      ...(autoTitleHuman ? { title: autoTitleHuman } : {}),
    })

    const outPayload = {
      text: fullText || '(空)',
      ok: true,
    }
    if (parsed) {
      outPayload.params = parsed.map
      outPayload.paramsList = parsed.list
      outPayload.paramsPreview = formatAddedParamsText(parsed.added, parsed.startIndex)
    }

    persistNodeIo(sessionId, node.id, {
      input: {
        ...prevIn,
        submitted: fullText || '',
        captureParams: !!captureParams,
      },
      output: outPayload,
      status: NODE_STATUS.SUCCEEDED,
      finished: true,
    })
    addMessage(sessionId, {
      role: 'user',
      type: 'text',
      node_instance_id: node.id,
      content: { text: fullText || '(空)', params: parsed?.map || undefined },
    })
    if (parsed?.added?.length) {
      addMessage(sessionId, {
        role: 'system',
        type: 'status',
        content: {
          text: `已写入项目参数：${formatAddedParamsText(parsed.added, parsed.startIndex)}`,
          params: parsed.map,
          paramsList: parsed.list,
        },
      })
    }
    // 人工步结束：刷新群报告后继续（无 bat；成功/失败语义由后续节点决定）
    refreshSessionAnnouncement(sessionId)
    updateSession(sessionId, { current_step_index: node.step_index + 1 })
    setImmediate(() => advance(sessionId).catch(console.error))
    return { ok: true, submitted: true }
  }

  if (action === 'approve' || action === 'admin_approve') {
    const out = parseJson(node.output_json, {})
    // 兼容旧会话遗留的 path_busy 闸门：同意 = 直接重试执行（已不再互斥拦截）
    if (out.code === 'PATH_BUSY' || out.pathBusy) {
      const { note } = bindGateHumanInput(sessionId, {
        text,
        action: 'approve',
        actionLabel: '重试（目录）',
        nodeTitle: node.title || `步骤 ${Number(node.step_index) + 1}`,
        nodeInstanceId: node.id,
      })
      addMessage(sessionId, {
        role: 'user',
        type: 'gate',
        node_instance_id: node.id,
        content: {
          text: note ? `重试：${note}` : '已确认重试',
          action: 'approve',
          mode: 'path_busy',
        },
      })
      updateNode(node.id, {
        status: NODE_STATUS.PENDING,
        output_json: JSON.stringify({ retriedPathBusy: true }),
        finished_at: null,
      })
      updateSession(sessionId, {
        status: SESSION_STATUS.ACTIVE,
        current_step_index: node.step_index,
      })
      setImmediate(() => advance(sessionId).catch(console.error))
      return { ok: true, pathBusyRetry: true }
    }
    // R03：已通过则幂等返回
    if (
      out.humanAction === 'approve' &&
      (node.status === NODE_STATUS.SUCCEEDED || node.status === NODE_STATUS.FAILED)
    ) {
      return { ok: true, idempotent: true, action: 'approve' }
    }
    if (node.status !== NODE_STATUS.WAITING_HUMAN) {
      throw Object.assign(new Error('当前节点不在等待审核状态'), { code: 'NOT_WAITING' })
    }
    const flow = normalizeStepFlow(out.flow, node.gate)
    const { note } = bindGateHumanInput(sessionId, {
      text,
      action: 'approve',
      actionLabel: '同意',
      nodeTitle: node.title || `步骤 ${Number(node.step_index) + 1}`,
      nodeInstanceId: node.id,
    })
    const votes = {
      auto: !!out.votes?.auto,
      human: !!out.votes?.human,
      admin: !!out.votes?.admin,
    }
    // 人工点同意 → human；显式 admin_approve → admin；默认 UI 同意同时记 human（有人工要求时）
    if (action === 'admin_approve' || out.requireAdmin) {
      votes.admin = true
    }
    if (action === 'approve') {
      votes.human = true
      // 无强制人工时，同意也可计管理员票
      if (!out.requireHuman && flow.admin) votes.admin = true
    }

    // 通过规则：须显式点同意（human / admin）；auto 产出票不能单独通过
    const passed = out.requireHuman
      ? !!votes.human
      : !!(votes.human || votes.admin)

    const baseLabel = action === 'admin_approve' ? '管理员已同意' : '已同意'
    addMessage(sessionId, {
      role: 'user',
      type: 'gate',
      node_instance_id: node.id,
      content: {
        text: note ? `${baseLabel}：${note}` : baseLabel,
        action: 'approve',
        note: note || undefined,
        votes,
      },
    })

    const outWithNote = {
      ...out,
      votes,
      humanAction: 'approve',
      ...(note
        ? {
            humanNote: note,
            humanNoteAt: nowIso(),
          }
        : {}),
    }

    if (!passed) {
      updateNode(node.id, {
        status: NODE_STATUS.WAITING_HUMAN,
        output_json: JSON.stringify(outWithNote),
      })
      addMessage(sessionId, {
        role: 'system',
        type: 'status',
        content: {
          text: out.requireHuman
            ? '已记录同意，但仍需满足人工审核条件。'
            : '票数不足，继续等待确认。',
        },
      })
      refreshSessionAnnouncement(sessionId)
      return { ok: true, passed: false }
    }

    updateNode(node.id, {
      status: NODE_STATUS.SUCCEEDED,
      finished_at: nowIso(),
      output_json: JSON.stringify({ ...outWithNote, passed: true }),
    })
    // 同意后刷新群报告（含附言与节点产出）
    refreshSessionAnnouncement(sessionId)
    updateSession(sessionId, {
      status: SESSION_STATUS.ACTIVE,
      current_step_index: node.step_index + 1,
    })
    setImmediate(() => advance(sessionId).catch(console.error))
    return { ok: true, passed: true }
  }

  if (action === 'reject' || action === 'admin_reject') {
    const prevOut = parseJson(node.output_json, {})
    if (prevOut.humanAction === 'reject' && node.status === NODE_STATUS.FAILED) {
      return { ok: true, idempotent: true, action: 'reject' }
    }
    if (node.status !== NODE_STATUS.WAITING_HUMAN) {
      throw Object.assign(new Error('当前节点不在等待审核状态'), { code: 'NOT_WAITING' })
    }
    const { note } = bindGateHumanInput(sessionId, {
      text,
      action: 'reject',
      actionLabel: '拒绝',
      nodeTitle: node.title || `步骤 ${Number(node.step_index) + 1}`,
      nodeInstanceId: node.id,
    })
    addMessage(sessionId, {
      role: 'user',
      type: 'gate',
      node_instance_id: node.id,
      content: {
        text: note ? `已拒绝：${note}` : '已拒绝',
        action: 'reject',
        note: note || undefined,
      },
    })
    // 明确拒绝 = 不通过（保留产出 + 附言）
    updateNode(node.id, {
      status: NODE_STATUS.FAILED,
      finished_at: nowIso(),
      output_json: JSON.stringify({
        ...prevOut,
        humanNote: note || prevOut.humanNote,
        humanAction: 'reject',
        humanNoteAt: nowIso(),
        rejected: true,
      }),
    })
    addMessage(sessionId, {
      role: 'system',
      type: 'status',
      content: { text: note ? `明确拒绝：${note}` : '明确拒绝，节点不通过' },
    })
    refreshSessionAnnouncement(sessionId)
    requestArchiveConsent(sessionId, 'rejected')
    return { ok: true, rejected: true }
  }

  throw new Error(`未知动作: ${action}`)
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 从文本解析 @成员（按显示名 / name 最长优先）
 * @returns {Array<{id, display_name, name, kind, ...}>}
 */
export function parseMemberMentions(text, memberList) {
  const raw = String(text || '')
  if (!raw.includes('@') || !memberList?.length) return []
  const sorted = [...memberList].sort((a, b) => {
    const la = String(a.display_name || a.name || '').length
    const lb = String(b.display_name || b.name || '').length
    return lb - la
  })
  const hit = new Map()
  for (const m of sorted) {
    const names = [...new Set([m.display_name, m.name].filter(Boolean))]
    for (const n of names) {
      const re = new RegExp(`@${escapeRegExp(n)}(?=$|[\\s,，、@])`, 'g')
      if (re.test(raw)) {
        hit.set(m.id, m)
        break
      }
    }
  }
  return [...hit.values()]
}

/**
 * 流程外 @ 成员：写入可写场外节点；已归档则末尾扩展新段落。
 * 离开场外：右侧正常节点回主线（早于当前则线性追加克隆；本段归档，可再次扩展）。
 * 同一会话默认串行：后一条 @ 等前一条跑完再执行（不做并发调度）。
 */
const mentionInvokeTail = new Map()

function enqueueMentionInvoke(sessionId, task) {
  const prev = mentionInvokeTail.get(sessionId) || Promise.resolve()
  const next = prev
    .catch(() => {})
    .then(() => task())
  mentionInvokeTail.set(
    sessionId,
    next.finally(() => {
      if (mentionInvokeTail.get(sessionId) === next) mentionInvokeTail.delete(sessionId)
    }),
  )
  return next
}

export async function invokeMentionedMembers(sessionId, text) {
  return enqueueMentionInvoke(sessionId, () => runMentionedMembers(sessionId, text))
}

async function runMentionedMembers(sessionId, text) {
  const session = getSession(sessionId)
  if (!session) return { invoked: [] }
  if (session.status === SESSION_STATUS.ARCHIVED) return { invoked: [] }

  const members = getDb()
    .prepare('SELECT * FROM members WHERE enabled = 1')
    .all()
    .map((r) => ({
      ...r,
      config: parseJson(r.config_json, {}),
    }))

  const mentioned = parseMemberMentions(text, members)
  if (!mentioned.length) return { invoked: [] }

  let offsite = ensureOffsiteNode(sessionId, { expand: true })
  const group = getGroup(session.group_id)
  const ctx = parseJson(session.context_json, {})
  const mode = resolveOffsiteMode(session, offsite)
  const callArgs = extractCallArgsFromMention(text, mentioned)
  const paramsMap = injectCallArgsParam(resolveParamsMap(ctx, group), callArgs)
  const invoked = []
  const startedAt = nowIso()
  const startNodeId = offsite.id

  ctx.offsiteAssist = {
    active: true,
    nodeInstanceId: offsite.id,
    at: startedAt,
    mode,
    planned: mode === OFFSITE_MODE.PLANNED,
    mentionText: String(text || '').slice(0, 500),
  }
  updateSession(sessionId, { context_json: JSON.stringify(ctx) })

  const prevOut = parseJson(offsite.output_json, {})
  const history = Array.isArray(prevOut.assists) ? prevOut.assists : []
  updateNode(offsite.id, {
    status: NODE_STATUS.RUNNING,
    started_at: startedAt,
    finished_at: null,
  })
  persistNodeIo(sessionId, offsite.id, {
    input: {
      kind: 'offsite',
      text: String(text || ''),
      callArgs,
      at: startedAt,
    },
    output: {
      ...prevOut,
      waiting: false,
      offsiteIdle: false,
      archived: false,
      assists: history,
      lastMention: String(text || ''),
      mode,
      plannedPause: mode === OFFSITE_MODE.PLANNED,
    },
    status: NODE_STATUS.RUNNING,
  })

  addMessage(sessionId, {
    role: 'system',
    type: 'status',
    node_instance_id: offsite.id,
    content: {
      text:
        mode === OFFSITE_MODE.PLANNED
          ? `临时协助「${offsite.title || '临时协助'}」已挂起。回主线点「从这里继续」。`
          : `临时协助「${offsite.title || '临时协助'}」进行中。回主线点「从这里继续」。`,
      offsite: true,
      mode,
    },
  })

  for (const member of mentioned) {
    // 主线已回归并归档了原节点：流动扩展到新场外段落继续记结果
    if (isOffsiteArchived(sessionId, startNodeId) || isOffsiteArchived(sessionId, offsite.id)) {
      offsite = ensureOffsiteNode(sessionId, { expand: true })
    }

    addMessage(sessionId, {
      role: 'member',
      member_id: member.id,
      type: 'text',
      node_instance_id: offsite.id,
      content: {
        text: `▶ @${member.display_name || member.name} 协助处理中…`,
        adHoc: true,
        mention: true,
        offsite: true,
      },
    })

    let result
    try {
      result = await runMember(member, {
        group,
        sessionContext: {
          ...ctx,
          sessionTitle: session.title,
          params: paramsMap,
        },
        sessionId,
        nodeInstanceId: offsite.id,
        humanInput: callArgs,
        params: paramsMap,
      })
    } catch (e) {
      result = {
        ok: false,
        summary: e.message || '执行失败',
        error: { code: 'ADHOC', message: e.message },
      }
    }

    const still = getSession(sessionId)
    if (!still || still.status === SESSION_STATUS.ARCHIVED) break

    if (isOffsiteArchived(sessionId, offsite.id)) {
      offsite = ensureOffsiteNode(sessionId, { expand: true })
    }

    addMessage(sessionId, {
      role: 'member',
      member_id: member.id,
      type: 'text',
      node_instance_id: offsite.id,
      content: {
        text: result.summary || (result.ok ? '完成' : '失败'),
        ok: !!result.ok,
        data: result.data,
        adHoc: true,
        mention: true,
        offsite: true,
      },
    })
    invoked.push({
      memberId: member.id,
      memberName: member.display_name || member.name,
      ok: !!result.ok,
      summary: result.summary || '',
    })
  }

  const still2 = getSession(sessionId)
  if (!still2 || still2.status === SESSION_STATUS.ARCHIVED) {
    return { invoked, offsiteNodeId: offsite.id, offsiteMode: mode }
  }

  // 原段落已归档：结果落到当前可写/新扩展段落，并直接完成本段归档（流动、可多次）
  const startArchived = isOffsiteArchived(sessionId, startNodeId)
  if (isOffsiteArchived(sessionId, offsite.id)) {
    offsite = ensureOffsiteNode(sessionId, { expand: true })
  }

  const cur = getDb().prepare('SELECT * FROM node_instances WHERE id = ?').get(offsite.id)
  const curOut = parseJson(cur?.output_json, {})
  const assists = Array.isArray(curOut.assists) ? [...curOut.assists] : []
  assists.push({
    at: startedAt,
    finishedAt: nowIso(),
    text: String(text || ''),
    invoked,
    mode,
    expanded: startArchived,
  })

  if (startArchived) {
    // 回主线后的异步收尾 = 新场外段落，写完即归档（线性扩展）
    persistNodeIo(sessionId, offsite.id, {
      input: {
        kind: 'offsite',
        text: String(text || ''),
        callArgs,
        at: startedAt,
        lateExpand: true,
      },
      output: {
        ...curOut,
        assists,
        lastInvoked: invoked,
        humanAction: 'approve',
        mode: OFFSITE_MODE.INTERRUPT,
        archived: true,
        lateExpand: true,
        closedAt: nowIso(),
        closeReason: 'late_expand_archived',
      },
      status: NODE_STATUS.SUCCEEDED,
      finished: true,
    })
    addMessage(sessionId, {
      role: 'system',
      type: 'status',
      node_instance_id: offsite.id,
      content: {
        text: `临时协助「${offsite.title || '临时协助'}」本段已归档。主线仍以右侧时序为准。`,
        offsite: true,
        offsiteArchived: true,
        lateExpand: true,
      },
    })
    return { invoked, offsiteNodeId: offsite.id, offsiteMode: mode, lateExpand: true }
  }

  persistNodeIo(sessionId, offsite.id, {
    input: parseJson(cur?.input_json, {}),
    output: {
      ...curOut,
      assists,
      lastInvoked: invoked,
      humanAction: 'pending',
      mode,
      plannedPause: mode === OFFSITE_MODE.PLANNED,
      archived: false,
    },
    status: NODE_STATUS.WAITING_HUMAN,
    finished: false,
  })
  const ctxLive = parseJson(getSession(sessionId)?.context_json, {})
  ctxLive.offsiteAssist = {
    active: true,
    nodeInstanceId: offsite.id,
    at: startedAt,
    mode,
    planned: mode === OFFSITE_MODE.PLANNED,
  }
  updateSession(sessionId, { context_json: JSON.stringify(ctxLive) })
  emitSession(sessionId, {
    type: 'session.status',
    payload: {
      sessionId,
      status: still2.status,
      offsiteAssist: true,
      offsiteMode: mode,
      nodeInstanceId: offsite.id,
    },
  })

  return { invoked, offsiteNodeId: offsite.id, offsiteMode: mode }
}

/**
 * 闸门等待中用户发消息 / 跑脚本：写入附言，审核态保持 pending
 */
function appendPendingGateNote(sessionId, node, text) {
  const note = text != null ? String(text).trim() : ''
  if (!note || !node) return
  const prev = parseJson(node.output_json, {})
  const action = prev.humanAction === 'approve' || prev.humanAction === 'reject'
    ? prev.humanAction
    : 'pending'
  updateNode(node.id, {
    status: NODE_STATUS.WAITING_HUMAN,
    output_json: JSON.stringify({
      ...prev,
      humanAction: action,
      humanNote: note,
      humanNoteAt: nowIso(),
      pendingNotes: [
        ...(Array.isArray(prev.pendingNotes) ? prev.pendingNotes : []),
        { at: nowIso(), text: note },
      ],
    }),
  })
  recordUserChatInput(sessionId, note, {
    action: 'pending',
    actionLabel: '待定',
    nodeTitle: node.title || `步骤 ${Number(node.step_index) + 1}`,
    nodeInstanceId: node.id,
  })
}

export async function postUserMessage(sessionId, text, attachments = []) {
  const session = getSession(sessionId)
  if (!session) throw new Error('会话不存在')
  if (session.status === SESSION_STATUS.INTERRUPTED) {
    throw Object.assign(new Error('会话已中断，请先选择继续或放弃'), {
      code: 'INTERRUPTED',
    })
  }
  const atts = Array.isArray(attachments) ? attachments : []
  const content = {
    text: text || (atts.length ? `（附件 ${atts.length} 个）` : ''),
    attachments: atts,
  }

  // archived → 解档，仍在本会话（绝不因此新建 Session / 群聊）
  if (session.status === SESSION_STATUS.ARCHIVED) {
    unarchiveSession(sessionId, { reason: 'message' })
  }

  const live = getSession(sessionId)
  if (!live) throw new Error('会话不存在')

  if (live.status === SESSION_STATUS.WAITING_HUMAN) {
    // 优先当前游标上的待确认节点，避免旧闸门抢走提交
    const curIdx = Number(live.current_step_index)
    const waiters = getDb()
      .prepare(
        `SELECT * FROM node_instances WHERE session_id = ? AND status = ? AND step_type != ? ORDER BY step_index`,
      )
      .all(sessionId, NODE_STATUS.WAITING_HUMAN, STEP_TYPE.OFFSITE)
    const node =
      waiters.find((n) => Number(n.step_index) === curIdx) ||
      waiters.find((n) => Number(n.step_index) >= curIdx) ||
      waiters[waiters.length - 1] ||
      null

    const enabledMembers = getDb()
      .prepare('SELECT * FROM members WHERE enabled = 1')
      .all()
      .map((r) => ({
        ...r,
        config: parseJson(r.config_json, {}),
      }))
    const mentionOnly =
      /@/.test(content.text || '') && isMentionAssistOnly(content.text, enabledMembers)

    if (node && node.step_type === STEP_TYPE.HUMAN && !mentionOnly) {
      // 人工步骤提交：走闸门（纯 @成员协助除外）
      await handleGateAction(sessionId, {
        action: 'submit',
        text: content.text,
        nodeInstanceId: node.id,
      })
      if (atts.length) {
        addMessage(sessionId, {
          role: 'user',
          type: 'text',
          content,
        })
      }
      return { session: getSession(sessionId), newSession: false }
    }
    // CI01：缺参拦截后补参（纯 @协助除外）
    if (node && node.step_type === STEP_TYPE.MEMBER && !mentionOnly) {
      const out = parseJson(node.output_json, {})
      if (out.needParams || out.reason === 'missing_param_1') {
        await handleGateAction(sessionId, {
          action: 'submit',
          text: content.text,
          nodeInstanceId: node.id,
        })
        return { session: getSession(sessionId), newSession: false, needParamsFilled: true }
      }
    }
    // waiting / 纯 @协助：记消息到场外协助节点，不推进正常流程
    const offsiteNode =
      mentionOnly || /@/.test(content.text || '')
        ? ensureOffsiteNode(sessionId, { expand: true })
        : null
    const offsiteMode = offsiteNode ? resolveOffsiteMode(live, offsiteNode) : null
    const mainGateWaiting = !!(
      node &&
      (node.step_type === STEP_TYPE.HUMAN ||
        (node.step_type === STEP_TYPE.MEMBER &&
          (parseJson(node.output_json, {}).needParams ||
            parseJson(node.output_json, {}).reason === 'missing_param_1')))
    )
    addMessage(sessionId, {
      role: 'user',
      type: 'text',
      node_instance_id: offsiteNode?.id || null,
      content: { ...content, offsite: !!offsiteNode },
    })
    if ((content.text || '').trim()) {
      if (node && !mentionOnly) {
        appendPendingGateNote(sessionId, node, content.text)
      } else {
        recordUserChatInput(sessionId, content.text, {
          nodeTitle: offsiteNode?.title || node?.title,
          nodeInstanceId: offsiteNode?.id || node?.id,
        })
      }
      if (offsiteNode?.id) appendOffsiteNodeChat(sessionId, offsiteNode.id, content.text)
    }
    if (/@/.test(content.text || '')) {
      setImmediate(() => {
        invokeMentionedMembers(sessionId, content.text).catch((e) =>
          console.warn('[acw] @mention failed', e.message),
        )
      })
    }
    return {
      session: getSession(sessionId),
      newSession: false,
      mentionPending: true,
      offsiteMode,
      mainGateWaiting,
    }
  }

  if (!(content.text || '').trim() && !atts.length) {
    throw new Error('消息不能为空')
  }
  {
    const hasMention = /@/.test(content.text || '')
    const offsiteNode = hasMention
      ? ensureOffsiteNode(sessionId, { expand: true })
      : null
    const offsiteMode = offsiteNode ? resolveOffsiteMode(live, offsiteNode) : null
    addMessage(sessionId, {
      role: 'user',
      type: 'text',
      node_instance_id: offsiteNode?.id || null,
      content: hasMention ? { ...content, offsite: true } : content,
    })
    if ((content.text || '').trim()) {
      recordUserChatInput(sessionId, content.text, {
        nodeTitle: offsiteNode?.title,
        nodeInstanceId: offsiteNode?.id,
      })
      if (offsiteNode?.id) appendOffsiteNodeChat(sessionId, offsiteNode.id, content.text)
    }
    if (hasMention) {
      setImmediate(() => {
        invokeMentionedMembers(sessionId, content.text).catch((e) =>
          console.warn('[acw] @mention failed', e.message),
        )
      })
      return {
        session: getSession(sessionId),
        newSession: false,
        mentionPending: true,
        offsiteMode,
        mainGateWaiting: false,
      }
    }
  }
  return { session: getSession(sessionId), newSession: false }
}
