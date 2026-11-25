// 群聊用户消息入口：聊天记录、闸门附言、@协助分派。
// Imports: store, offsite, archive, gates, mentions (top of the engine DAG).
import { getDb, parseJson } from '../db.js'
import {
  SESSION_STATUS,
  NODE_STATUS,
  STEP_TYPE,
  SYSTEM_PARAM_KEYS,
  nowIso,
  appendProjectParams,
  applyProjectParamBind,
  parseProjectParams,
  resolveStepParamBindSlots,
  formatGroupCard,
  resolveGroupFolder,
  mergeSystemParams,
  isMentionAssistOnly,
  extractCallArgsFromMention,
} from '@acw/shared'
import { getSession, getGroup, getMember,  } from './store.js'
import { engineEmit } from './events.js'
import { ensureOffsiteNode, resolveOffsiteMode, appendOffsiteNodeChat } from './offsite.js'
import { unarchiveSession, refreshSessionAnnouncement } from './archive.js'
import { syncFurnaceSessionContext } from '../furnaceSituation.js'
import { handleGateAction } from './gates.js'
import { invokeMentionedMembers, parseMemberMentions } from './mentions.js'

function recordOffsiteOrChatInput(sessionId, text, enabledMembers, meta = {}) {
  const note = String(text || '').trim()
  if (!note) return null
  if (/@/.test(note)) {
    const mentioned = parseMemberMentions(note, enabledMembers)
    const callArgs = extractCallArgsFromMention(note, mentioned)
    return recordUserChatInput(sessionId, note, {
      ...meta,
      mentionAssist: true,
      callArgs,
      actionLabel: meta.actionLabel || '临时协助',
    })
  }
  return recordUserChatInput(sessionId, note, meta)
}

function memberNameResolver() {
  return (id) => {
    const m = getMember(id)
    return m?.display_name || m?.name || id
  }
}

/**
 * 群聊用户消息：追加 #1… 参数并记入群报告 userNotes（与人工闸门提交共用同一套 paramsList）
 * @param {{ mentionAssist?: boolean, callArgs?: string }} [opts] 临时协助 @：只写 #a，保留「下一步」绑定槽，不按正文递增 #n
 */
export function recordUserChatInput(
  sessionId,
  text,
  {
    action = 'chat',
    actionLabel = '群聊',
    nodeTitle,
    nodeInstanceId,
    mentionAssist = false,
    callArgs,
  } = {},
) {
  const note = text != null ? String(text).trim() : ''
  if (!note) return null
  const session = getSession(sessionId)
  if (!session) return null
  const group = getGroup(session.group_id)
  const steps = parseJson(group?.steps_json, [])
  const ctx = parseJson(session.context_json, {})
  const gObj = group ? { ...group, steps } : null
  const mergeOpts = {
    group: gObj,
    sessionContext: ctx,
    memberNameOf: memberNameResolver(),
  }

  let parsed = null
  const assistCallArgs =
    callArgs != null ? String(callArgs).trim() : mentionAssist ? '' : note

  if (mentionAssist) {
    ctx.lastHumanInput = assistCallArgs || note
    const bindSlots = resolveStepParamBindSlots(null, group)
    const bindTokens = assistCallArgs ? parseProjectParams(assistCallArgs).list : []
    if (assistCallArgs && bindSlots.length && bindTokens.length >= bindSlots.length) {
      const bind = applyProjectParamBind(ctx, assistCallArgs, bindSlots, { overwrite: true })
      if (!bind.useAppend) {
        parsed = {
          map: bind.map,
          bound: bind.bound,
          raw: bind.raw,
          added: bind.added,
        }
      }
    }
    ctx.params = mergeSystemParams(
      {
        ...(ctx.params && typeof ctx.params === 'object' ? ctx.params : {}),
        ...(parsed?.map || {}),
        [SYSTEM_PARAM_KEYS.CALL_ARGS]: assistCallArgs,
      },
      mergeOpts,
    )
  } else {
    ctx.lastHumanInput = note
    parsed = appendProjectParams(ctx, note)
    ctx.projectInfoRaw = [ctx.projectInfoRaw, parsed.raw]
      .filter((s) => s != null && String(s).trim())
      .join('\n')
    ctx.paramsList = parsed.list
    ctx.params = mergeSystemParams(
      {
        ...(ctx.params && typeof ctx.params === 'object' ? ctx.params : {}),
        ...parsed.map,
        [SYSTEM_PARAM_KEYS.CALL_ARGS]: note,
      },
      mergeOpts,
    )
  }

  if (gObj) {
    const sysCard =
      ctx.params?.[SYSTEM_PARAM_KEYS.GROUP_CARD] ||
      ctx.groupCard ||
      formatGroupCard(gObj, { memberNameOf: mergeOpts.memberNameOf })
    if (sysCard) ctx.groupCard = sysCard
    ctx.groupFolder = resolveGroupFolder(gObj, ctx)
  }
  ctx.userNotes = Array.isArray(ctx.userNotes) ? ctx.userNotes : []
  ctx.userNotes.push({
    at: nowIso(),
    action,
    actionLabel,
    text: note,
    nodeTitle: nodeTitle || undefined,
    nodeInstanceId: nodeInstanceId || undefined,
  })
  engineEmit('persist_session', sessionId, {
    context_json: JSON.stringify(ctx),
  })
  refreshSessionAnnouncement(sessionId)
  try {
    syncFurnaceSessionContext(sessionId, { keepRole: true })
  } catch (e) {
    console.warn('[acw] furnace situation chat', e?.message || e)
  }
  return parsed
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
  engineEmit('update_node', node.id, {
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
        engineEmit('add_message', sessionId, {
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
    engineEmit('add_message', sessionId, {
      role: 'user',
      type: 'text',
      node_instance_id: offsiteNode?.id || null,
      content: { ...content, offsite: !!offsiteNode },
    })
    if ((content.text || '').trim()) {
      if (node && !mentionOnly) {
        appendPendingGateNote(sessionId, node, content.text)
      } else {
        recordOffsiteOrChatInput(sessionId, content.text, enabledMembers, {
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
    const enabledMembers = getDb()
      .prepare('SELECT * FROM members WHERE enabled = 1')
      .all()
      .map((r) => ({
        ...r,
        config: parseJson(r.config_json, {}),
      }))
    const offsiteNode = hasMention
      ? ensureOffsiteNode(sessionId, { expand: true })
      : null
    const offsiteMode = offsiteNode ? resolveOffsiteMode(live, offsiteNode) : null
    engineEmit('add_message', sessionId, {
      role: 'user',
      type: 'text',
      node_instance_id: offsiteNode?.id || null,
      content: hasMention ? { ...content, offsite: true } : content,
    })
    if ((content.text || '').trim()) {
      recordOffsiteOrChatInput(sessionId, content.text, enabledMembers, {
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
