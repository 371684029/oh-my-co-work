// 会话生命周期：创建（群聊 / 成员单聊）、克隆续跑、中断恢复。
// Imports: store, offsite, archive, advance (gates sits above).
import { getDb, parseJson } from '../db.js'
import { emitSession, emitAll } from '../bus.js'
import { killSessionProcesses } from '../processRegistry.js'
import {
  SESSION_STATUS,
  NODE_STATUS,
  STEP_TYPE,
  nowIso,
  uid,
  normalizeStepFlow,
  flowNeedsWait,
  abbrGroupTag,
  formatSessionAutoTitle,
  formatGroupCard,
  resolveGroupFolder,
  SYSTEM_PARAM_KEYS,
  FURNACE_ROLE,
} from '@acw/shared'
import { resolveGroupAdmin } from '../appSettings.js'
import { syncFurnaceSessionContext } from '../furnaceSituation.js'
import {
  getMember,
  getGroup,
  getSession,
  updateSession,
  updateNode,
  addMessage,
  persistNodeIo,
  templateStepIndexOf,
  nodeLooksCloned,
  stepAdaptInput,
} from './store.js'
import { archiveOffsiteOnReturnToMain } from './offsite.js'
import { unarchiveSession, skipArchiveNode } from './archive.js'
import { advance } from './advance.js'

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
    `INSERT INTO node_instances (id, session_id, step_index, step_id, title, step_type, member_id, status, gate, input_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      stepAdaptInput(step),
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
    try {
      syncFurnaceSessionContext(sessionId, { role: FURNACE_ROLE.SESSION })
    } catch (e) {
      console.warn('[acw] furnace situation adhoc', e?.message || e)
    }
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
  try {
    syncFurnaceSessionContext(sessionId, { role: FURNACE_ROLE.SESSION })
  } catch (e) {
    console.warn('[acw] furnace situation start', e?.message || e)
  }
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
      ...(raw.config?.adapt ? { adapt: true } : {}),
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

/**
 * 「从这里继续」后：旧轨上仍 waiting/running/pending（含未跑过的归档）标为跳过（已绕过），
 * 避免多处「待确认」抢交互，并让流程轨折叠这些废弃节点。
 * - beforeStepIndex 有值（往前跳）：只处理该下标之前的节点
 * - 无 beforeStepIndex（往回/再跑克隆）：旧轨上未完成的一并绕过
 */
export function bypassAbandonedNodes(sessionId, { keepNodeIds = [], beforeStepIndex = null } = {}) {
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
      JSON.stringify({ ...meta, ...(step.adapt ? { adapt: true } : {}) }),
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
