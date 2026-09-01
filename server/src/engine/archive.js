// 归档 / 解档 / 中断标记 / 群报告台账。
// Imports: store, offsite (below advance/gates in the engine DAG).
import { getDb, parseJson } from '../db.js'
import { emitSession, emitAll } from '../bus.js'
import {
  NODE_STATUS,
  SESSION_STATUS,
  STEP_TYPE,
  nowIso,
} from '@acw/shared'
import {
  killSessionProcesses,
  cleanupArchivedSessionPidFiles,
} from '../processRegistry.js'
import {
  writeSessionJournalIndex,
  writeSessionAnnouncement,
  readSessionAnnouncement,
  saveSessionAnnouncementRaw,
} from '../journal.js'
import { getSession, updateSession, addMessage, updateNode, getMember, persistNodeIo } from './store.js'

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

export function skipArchiveNode(sessionId, node, reason = 'completed') {
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
