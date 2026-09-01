// 闸门动作：幂等、启动确认、归档确认、人工输入、同意/拒绝。
// Imports: store, offsite, archive, adapterEvents, sessionLifecycle, advance.
import { getDb, parseJson } from '../db.js'
import { emitSession } from '../bus.js'
import {
  SESSION_STATUS,
  NODE_STATUS,
  STEP_TYPE,
  SYSTEM_PARAM_KEYS,
  FURNACE_DISPLAY_NAME,
  FURNACE_ROLE,
  nowIso,
  normalizeStepFlow,
  appendProjectParams,
  formatAddedParamsText,
  formatGroupCard,
  resolveGroupFolder,
  mergeSystemParams,
  isMentionAssistOnly,
} from '@acw/shared'
import {
  getSession,
  getGroup,
  getMember,
  updateSession,
  updateNode,
  addMessage,
  persistNodeIo,
  resolveStepForNode,
  templateStepIndexOf,
  syncAutoSessionTitle,
  bindGateHumanInput,
} from './store.js'
import { archiveOffsiteOnReturnToMain } from './offsite.js'
import {
  archiveSession,
  requestArchiveConsent,
  refreshSessionAnnouncement,
} from './archive.js'
import { answerAdapterQuestion } from './adapterEvents.js'
import { resolveInterruptedSession } from './sessionLifecycle.js'
import { advance } from './advance.js'
import { syncFurnaceSessionContext } from '../furnaceSituation.js'

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
      try {
        syncFurnaceSessionContext(sessionId, { role: FURNACE_ROLE.SESSION })
      } catch (e) {
        console.warn('[acw] furnace situation kickoff', e?.message || e)
      }
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

    const baseLabel = action === 'admin_approve' ? `${FURNACE_DISPLAY_NAME}已同意` : '已同意'
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
