// advance() 主循环：节点推进、成员执行、审核闸门打开。
// Imports: store, archive (sessionLifecycle/gates sit above and import from here).
import { getDb, parseJson } from '../db.js'
import { emitSession } from '../bus.js'
import { runMember } from '../runners.js'
import {
  killSessionProcesses,
  killMemberProcesses,
} from '../processRegistry.js'
import {
  SESSION_STATUS,
  NODE_STATUS,
  STEP_TYPE,
  OFFSITE_MODE,
  FURNACE_DISPLAY_NAME,
  FURNACE_ROLE,
  nowIso,
  normalizeStepFlow,
  injectCallArgsParam,
  SYSTEM_PARAM_KEYS,
} from '@acw/shared'
import { getAppSettings } from '../appSettings.js'
import { prepareAdaptForMember, adaptStatusText } from '../adaptBackup.js'
import {
  resolveAdaptFurnaceRole,
} from '../furnaceContext.js'
import { syncFurnaceSessionContext, touchFurnaceWorkflow } from '../furnaceSituation.js'
import { formatFurnaceRoleNotice } from '../furnaceGrokInject.js'
import {
  getMember,
  getGroup,
  getSession,
  updateSession,
  updateNode,
  addMessage,
  persistNodeIo,
  resolveStepForNode,
  templateStepIndexOf,
  memberNeedsProjectParams,
  hasProjectParam1,
  resolveParamsMap,
} from './store.js'
import { skipArchiveNode, dismissPendingArchiveIfAny, archiveSession, refreshSessionAnnouncement } from './archive.js'

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
      touchFurnaceWorkflow(sessionId, { nodeId: node.id, keepRole: true })
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
    touchFurnaceWorkflow(sessionId, { nodeId: node.id, keepRole: true })
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
      touchFurnaceWorkflow(sessionId, { nodeId: node.id, keepRole: true })
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
    const wantAdapt = !!(
      step?.adapt ||
      parseJson(node.input_json, {}).adapt ||
      member.config?.adapt
    )
    let runMemberAs = member
    let adaptPrep = null
    if (wantAdapt) {
      const furnaceRole = resolveAdaptFurnaceRole({
        stepAdapt: !!(step?.adapt || parseJson(node.input_json, {}).adapt),
        memberAdapt: !!member.config?.adapt,
      })
      if (furnaceRole) {
        try {
          const pack = syncFurnaceSessionContext(sessionId, {
            role: furnaceRole,
            nodeId: node.id,
          })
          addMessage(sessionId, {
            role: 'system',
            type: 'status',
            node_instance_id: node.id,
            content: { text: formatFurnaceRoleNotice(pack) },
          })
        } catch (e) {
          console.warn('[acw] furnace role', e?.message || e)
        }
      }
      try {
        adaptPrep = prepareAdaptForMember(member, {
          sessionId,
          nodeId: node.id,
          backup: getAppSettings().adapt?.backup !== false,
        })
      } catch (e) {
        adaptPrep = {
          canEdit: false,
          fallback: true,
          enableJsonl: false,
          reason: 'backup_failed',
          error: e?.message || String(e),
          member,
        }
      }
      runMemberAs = adaptPrep.member || member
      addMessage(sessionId, {
        role: 'system',
        type: 'status',
        node_instance_id: node.id,
        content: { text: adaptStatusText(adaptPrep) },
      })
    }
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
      ...(wantAdapt
        ? {
            adapt: true,
            adaptFallback: !!adaptPrep?.fallback,
            adaptReason: adaptPrep?.reason || null,
            adaptBackup: adaptPrep?.backup?.zipPath || null,
            adaptPatched: adaptPrep?.patched || [],
          }
        : {}),
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

    const result = await runMember(runMemberAs, {
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
    touchFurnaceWorkflow(sessionId, { nodeId: node.id, keepRole: true })

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
      if (flow.admin) bits.push(`可${FURNACE_DISPLAY_NAME}确认`)
      if (flow.auto) bits.push('已记自动产出票')
      const last = isLastMainlineNode(sessionId, node) && !isAdhocSession(sessionId)
      openFlowGate(sessionId, node, {
        flow,
        failed: false,
        lastNodeComplete: last,
        text: last
          ? `「${node.title}」已产出，这是最后一步。同意即完成群聊并归档（释放本会话进程与目录占用）。${bits.join('；')}。`
          : `「${node.title}」已产出，审核中（pending）。${bits.join('；')}。输入或再跑脚本不会自动通过/拒绝。`,
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

  // 全部步骤完成：群聊默认归档释放资源；成员单聊（adhoc）保持进行中
  finishMainlineIfComplete(sessionId)
}

function isLastMainlineNode(sessionId, node) {
  const later =
    getDb()
      .prepare(
        `SELECT COUNT(*) AS c FROM node_instances
         WHERE session_id = ? AND step_index > ? AND IFNULL(step_type,'') != ?`,
      )
      .get(sessionId, node.step_index, STEP_TYPE.ARCHIVE)?.c || 0
  return later === 0
}

function isAdhocSession(sessionId) {
  const session = getSession(sessionId)
  if (!session) return false
  const group = getGroup(session.group_id)
  const cfg = parseJson(group?.config_json, {})
  return cfg.adhoc === true
}

function finishMainlineIfComplete(sessionId) {
  refreshSessionAnnouncement(sessionId)
  if (isAdhocSession(sessionId)) {
    dismissPendingArchiveIfAny(sessionId, 'completed')
    const s = getSession(sessionId)
    if (s && s.status !== SESSION_STATUS.ARCHIVED && s.status !== SESSION_STATUS.INTERRUPTED) {
      updateSession(sessionId, { status: SESSION_STATUS.ACTIVE })
    }
    return
  }
  archiveSession(sessionId, 'completed')
}

/** 打开流转闸门（人工/管理员）；审核态先置 pending */
export function openFlowGate(sessionId, node, payload) {
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
      lastNodeComplete: !!payload.lastNodeComplete,
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
      lastNodeComplete: !!payload.lastNodeComplete,
      summary: payload.summary,
      humanAction: 'pending',
      policy:
        '审核三态：pending（待定）/ 通过 / 拒绝。输入框发消息或执行脚本保持 pending；须点「同意」才通过、「拒绝」才不通过。',
    },
  })
  // 管理员总结与流转：闸门打开后刷新群报告 MD
  if (payload.flow?.admin || payload.requireAdmin) {
    try {
      const pack = syncFurnaceSessionContext(sessionId, {
        role: FURNACE_ROLE.REVIEW,
        nodeId: node.id,
      })
      addMessage(sessionId, {
        role: 'system',
        type: 'status',
        node_instance_id: node.id,
        content: { text: formatFurnaceRoleNotice(pack) },
      })
    } catch (e) {
      console.warn('[acw] furnace review context', e?.message || e)
    }
    refreshSessionAnnouncement(sessionId)
  } else {
    touchFurnaceWorkflow(sessionId, { nodeId: node.id, keepRole: true })
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
