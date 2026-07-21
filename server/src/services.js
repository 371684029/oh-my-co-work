import { getDb, parseJson } from './db.js'
import {
  nowIso,
  uid,
  cloneName,
  MEMBER_KIND,
  defaultStepFlow,
  normalizeStepFlow,
  flowNeedsWait,
} from '@acw/shared'
import {
  createSessionFromGroup,
  createSessionFromMember,
  archiveSession,
  handleGateAction,
  postUserMessage,
  advance,
  refreshSessionAnnouncement,
  saveSessionAnnouncement,
  requestArchiveConsent,
  processDueArchives,
  restartFromNode,
} from './engine.js'
import { killSessionProcesses } from './processRegistry.js'
import { getAppSettings, isDemoMember, isDemoGroup } from './appSettings.js'
import { readSessionAnnouncement } from './journal.js'

function memberRow(r) {
  if (!r) return null
  return {
    ...r,
    enabled: !!r.enabled,
    config: parseJson(r.config_json, {}),
  }
}

function groupRow(r) {
  if (!r) return null
  return {
    ...r,
    enabled: !!r.enabled,
    steps: parseJson(r.steps_json, []),
    config: parseJson(r.config_json, {}),
  }
}

/** 规范化群级管理员配置（可继承全局 / 可空） */
function normalizeGroupAdminConfig(admin) {
  if (admin == null || admin === '') {
    return { inherit: true, memberId: null, defaultFlow: null }
  }
  if (typeof admin !== 'object') {
    return { inherit: true, memberId: null, defaultFlow: null }
  }
  const inherit = admin.inherit !== false
  let defaultFlow = null
  if (!inherit && admin.defaultFlow && typeof admin.defaultFlow === 'object') {
    defaultFlow = {
      admin: !!admin.defaultFlow.admin,
      auto: !!admin.defaultFlow.auto,
      human: !!admin.defaultFlow.human,
    }
  }
  return {
    inherit,
    memberId: inherit ? null : admin.memberId || null,
    defaultFlow,
  }
}

function buildGroupConfig(body, prevConfig = {}) {
  const cfg = { ...(prevConfig && typeof prevConfig === 'object' ? prevConfig : {}) }
  if (body.config && typeof body.config === 'object') {
    Object.assign(cfg, body.config)
  }
  if (body.admin !== undefined) {
    cfg.admin = normalizeGroupAdminConfig(body.admin)
  } else if (!cfg.admin) {
    cfg.admin = { inherit: true, memberId: null, defaultFlow: null }
  }
  return cfg
}

function sessionRow(r) {
  if (!r) return null
  return {
    ...r,
    pinned: !!r.pinned,
    context: parseJson(r.context_json, {}),
  }
}

// —— Members ——
export function listMembers({ includeDemo } = {}) {
  const showDemo = includeDemo !== undefined ? includeDemo : getAppSettings().showDemo
  let list = getDb()
    .prepare('SELECT * FROM members ORDER BY created_at DESC')
    .all()
    .map(memberRow)
  if (!showDemo) list = list.filter((m) => !isDemoMember(m))
  return list
}

export function getMember(id) {
  return memberRow(getDb().prepare('SELECT * FROM members WHERE id = ?').get(id))
}

export function createMember(body) {
  const id = uid('mem')
  const t = nowIso()
  const config = body.config || {}
  if (body.kind === MEMBER_KIND.SCRIPT && body.script) {
    config.script = body.script
  }
  getDb()
    .prepare(
      `INSERT INTO members (id, name, display_name, kind, work_folder, config_json, enabled, cloned_from_id, clone_generation, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    )
    .run(
      id,
      body.name || id,
      body.displayName || body.display_name || body.name || id,
      body.kind || MEMBER_KIND.ECHO,
      body.workFolder || body.work_folder || null,
      JSON.stringify(config),
      body.clonedFromId || null,
      body.cloneGeneration || 0,
      t,
      t,
    )
  return getMember(id)
}

export function cloneMember(id, overrides = {}) {
  const src = getMember(id)
  if (!src) throw new Error('成员不存在')
  return createMember({
    name: overrides.name || `${src.name}_clone`,
    displayName: overrides.displayName || cloneName(src.display_name),
    kind: overrides.kind || src.kind,
    workFolder: overrides.workFolder ?? src.work_folder,
    config: overrides.config || src.config,
    script: overrides.script || src.config?.script,
    clonedFromId: src.id,
    cloneGeneration: (src.clone_generation || 0) + 1,
  })
}

export function updateMember(id, body = {}) {
  const src = getMember(id)
  if (!src) throw new Error('成员不存在')
  const t = nowIso()
  let config = src.config || {}
  if (body.config !== undefined) {
    config = body.config || {}
  } else if (body.kind === MEMBER_KIND.SCRIPT || src.kind === MEMBER_KIND.SCRIPT) {
    if (body.script) config = { ...config, script: body.script }
  }
  const kind = body.kind || src.kind
  if (kind === MEMBER_KIND.ECHO && body.config === undefined && !body.script) {
    // keep config unless replaced
  }
  const displayName = body.displayName || body.display_name || src.display_name
  const name = body.name || src.name
  const workFolder =
    body.workFolder !== undefined
      ? body.workFolder || null
      : body.work_folder !== undefined
        ? body.work_folder || null
        : src.work_folder
  getDb()
    .prepare(
      `UPDATE members SET name=?, display_name=?, kind=?, work_folder=?, config_json=?, updated_at=? WHERE id=?`,
    )
    .run(name, displayName, kind, workFolder, JSON.stringify(config), t, id)
  return getMember(id)
}

export function deleteMember(id) {
  const used = getDb()
    .prepare('SELECT id, title, steps_json FROM groups')
    .all()
    .filter((g) => {
      const steps = parseJson(g.steps_json, [])
      return steps.some((s) => s.memberId === id)
    })
  if (used.length) {
    throw new Error(`成员仍被群模板引用: ${used.map((u) => u.title).join(', ')}`)
  }
  getDb().prepare('DELETE FROM members WHERE id = ?').run(id)
}

// —— Groups ——
export function listGroups({ includeDemo, includeAdhoc } = {}) {
  const showDemo = includeDemo !== undefined ? includeDemo : getAppSettings().showDemo
  let list = getDb()
    .prepare('SELECT * FROM groups ORDER BY created_at DESC')
    .all()
    .map(groupRow)
  if (!showDemo) list = list.filter((g) => !isDemoGroup(g))
  // 单聊开聊产生的临时模板默认不进群列表 / 设置
  if (!includeAdhoc) list = list.filter((g) => !g.config?.adhoc)
  return list
}

export function getGroup(id) {
  return groupRow(getDb().prepare('SELECT * FROM groups WHERE id = ?').get(id))
}

function normalizeSteps(steps) {
  return (steps || []).map((s, i) => {
    const flow = normalizeStepFlow(s.flow, s.gate)
    // gate 兼容列：人工或管理员任一需要等待
    const gate = flowNeedsWait(flow) || !!s.gate
    const row = {
      id: s.id || `step_${i}`,
      title: s.title || `步骤 ${i + 1}`,
      type: s.type || 'member',
      memberId: s.memberId || null,
      gate,
      flow,
    }
    if (row.type === 'human') {
      // 首步默认采集项目参数；显式 false 可关
      row.captureParams =
        s.captureParams === true
          ? true
          : s.captureParams === false
            ? false
            : i === 0
    }
    return row
  })
}

export function createGroup(body) {
  const id = uid('grp')
  const t = nowIso()
  const steps = normalizeSteps(body.steps || [])
  const config = buildGroupConfig(body, {})
  getDb()
    .prepare(
      `INSERT INTO groups (id, title, description, work_folder, steps_json, config_json, enabled, cloned_from_id, clone_generation, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    )
    .run(
      id,
      body.title || '未命名群',
      body.description || '',
      body.workFolder || body.work_folder || null,
      JSON.stringify(steps),
      JSON.stringify(config),
      body.clonedFromId || null,
      body.cloneGeneration || 0,
      t,
      t,
    )
  return getGroup(id)
}

export function cloneGroup(id, overrides = {}) {
  const src = getGroup(id)
  if (!src) throw new Error('群模板不存在')
  return createGroup({
    title: overrides.title || cloneName(src.title),
    description: overrides.description ?? src.description,
    workFolder: overrides.workFolder ?? src.work_folder,
    steps: overrides.steps || src.steps,
    config: overrides.config || src.config,
    admin: overrides.admin !== undefined ? overrides.admin : src.config?.admin,
    clonedFromId: src.id,
    cloneGeneration: (src.clone_generation || 0) + 1,
  })
}

export function updateGroup(id, body = {}) {
  const src = getGroup(id)
  if (!src) throw new Error('群模板不存在')
  const t = nowIso()
  const title = body.title ?? src.title
  const description =
    body.description !== undefined ? body.description : src.description || ''
  const workFolder =
    body.workFolder !== undefined
      ? body.workFolder || null
      : body.work_folder !== undefined
        ? body.work_folder || null
        : src.work_folder
  let steps = src.steps || []
  if (Array.isArray(body.steps)) {
    steps = normalizeSteps(body.steps)
  }
  const config = buildGroupConfig(body, src.config || {})
  getDb()
    .prepare(
      `UPDATE groups SET title=?, description=?, work_folder=?, steps_json=?, config_json=?, updated_at=? WHERE id=?`,
    )
    .run(title, description, workFolder, JSON.stringify(steps), JSON.stringify(config), t, id)
  return getGroup(id)
}

export function deleteGroup(id) {
  const active = getDb()
    .prepare(`SELECT COUNT(*) AS c FROM sessions WHERE group_id = ? AND status != 'archived'`)
    .get(id)
  if (active?.c > 0) throw new Error('仍有进行中的聊天，无法删除群模板')
  getDb().prepare('DELETE FROM groups WHERE id = ?').run(id)
}

// —— Sessions ——
export function listSessions({ status, includeDemo } = {}) {
  let rows
  if (status) {
    rows = getDb()
      .prepare('SELECT * FROM sessions WHERE status = ? ORDER BY pinned DESC, updated_at DESC')
      .all(status)
  } else {
    rows = getDb()
      .prepare('SELECT * FROM sessions ORDER BY pinned DESC, updated_at DESC')
      .all()
  }
  const groupMetaById = new Map(
    getDb()
      .prepare('SELECT id, title, config_json FROM groups')
      .all()
      .map((g) => {
        let cfg = {}
        try {
          cfg = g.config_json ? JSON.parse(g.config_json) : {}
        } catch {
          cfg = {}
        }
        return [
          g.id,
          {
            title: g.title || '',
            adhoc: cfg.adhoc === true,
            fromMemberId: cfg.fromMemberId || null,
          },
        ]
      }),
  )
  let list = rows.map((r) => {
    const s = sessionRow(r)
    const meta = groupMetaById.get(s.group_id) || {}
    const groupTitle = s.context?.groupTitle || meta.title || ''
    const adhoc =
      s.context?.adhoc === true ||
      meta.adhoc === true ||
      String(groupTitle).startsWith('单聊')
    return {
      ...s,
      groupTitle,
      groupTitleAbbr: s.context?.groupTitleAbbr || '',
      adhoc: !!adhoc,
      fromMemberId: meta.fromMemberId || s.context?.fromMemberId || null,
    }
  })
  const showDemo = includeDemo !== undefined ? includeDemo : getAppSettings().showDemo
  if (!showDemo) {
    const demoGroupIds = new Set(
      getDb()
        .prepare('SELECT * FROM groups')
        .all()
        .map(groupRow)
        .filter(isDemoGroup)
        .map((g) => g.id),
    )
    list = list.filter((s) => !demoGroupIds.has(s.group_id))
  }
  return list
}

export function getSessionDetail(id) {
  const session = sessionRow(getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id))
  if (!session) return null
  const group = getGroup(session.group_id)
  const nodes = getDb()
    .prepare('SELECT * FROM node_instances WHERE session_id = ? ORDER BY step_index')
    .all(id)
    .map((n) => ({
      ...n,
      gate: !!n.gate,
      input: parseJson(n.input_json, null),
      output: parseJson(n.output_json, null),
      journalPath: n.journal_path || null,
    }))
  const messages = getDb()
    .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC')
    .all(id)
    .map((m) => ({
      ...m,
      content: parseJson(m.content_json, {}),
    }))
  const ann = readSessionAnnouncement(id)
  return {
    session,
    group,
    nodes,
    messages,
    announcement: ann
      ? { path: ann.rel, markdown: ann.markdown }
      : session.context?.announcementPath
        ? { path: session.context.announcementPath, markdown: null }
        : null,
  }
}

export function renameSession(id, title) {
  const s = sessionRow(getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id))
  if (!s) throw new Error('会话不存在')
  const ctx = { ...(s.context || {}) }
  // 手改标题后不再自动跟 #1 / 模板缩写
  ctx.titleAuto = false
  getDb()
    .prepare('UPDATE sessions SET title = ?, context_json = ?, updated_at = ? WHERE id = ?')
    .run(title, JSON.stringify(ctx), nowIso(), id)
  return sessionRow(getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id))
}

/** 会话置顶 / 取消置顶 */
export function pinSession(id, pinned = true) {
  const row = getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id)
  if (!row) throw new Error('会话不存在')
  const flag = pinned ? 1 : 0
  getDb()
    .prepare('UPDATE sessions SET pinned = ?, updated_at = ? WHERE id = ?')
    .run(flag, nowIso(), id)
  return sessionRow(getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id))
}

/**
 * 会话备注（写入 context.notes，不覆盖自动群报告）
 * @returns {{ ok: true, notes: string, session: object }}
 */
export function saveSessionNotes(id, notes) {
  const row = getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id)
  if (!row) throw new Error('会话不存在')
  const ctx = parseJson(row.context_json, {})
  ctx.notes = String(notes ?? '')
  getDb()
    .prepare('UPDATE sessions SET context_json = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(ctx), nowIso(), id)
  const session = sessionRow(getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id))
  return { ok: true, notes: ctx.notes, session }
}

export function deleteSession(id) {
  try {
    killSessionProcesses(id)
  } catch {
    /* ignore */
  }
  getDb().prepare('DELETE FROM messages WHERE session_id = ?').run(id)
  getDb().prepare('DELETE FROM node_instances WHERE session_id = ?').run(id)
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(id)
}

export {
  createSessionFromGroup,
  createSessionFromMember,
  archiveSession,
  handleGateAction,
  postUserMessage,
  refreshSessionAnnouncement,
  saveSessionAnnouncement,
  requestArchiveConsent,
  processDueArchives,
  advance,
  restartFromNode,
}
