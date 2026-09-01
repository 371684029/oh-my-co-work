// @成员 临时协助：提及解析、串行执行队列、场外节点结果落地。
// Imports: store, offsite.
import { getDb, parseJson } from '../db.js'
import { emitSession } from '../bus.js'
import { runMember } from '../runners.js'
import {
  SESSION_STATUS,
  NODE_STATUS,
  OFFSITE_MODE,
  nowIso,
  extractCallArgsFromMention,
  injectCallArgsParam,
} from '@acw/shared'
import {
  getSession,
  getGroup,
  updateSession,
  updateNode,
  addMessage,
  persistNodeIo,
  resolveParamsMap,
} from './store.js'
import { ensureOffsiteNode, resolveOffsiteMode, isOffsiteArchived } from './offsite.js'

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
