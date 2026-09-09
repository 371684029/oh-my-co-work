import { getDb, parseJson } from './db.js'
import { enrichScriptConfig, assertScriptWorkDirConfigured } from './runners.js'
import {
  nowIso,
  uid,
  cloneName,
  MEMBER_KIND,
  normalizeStepFlow,
  flowNeedsWait,
} from '@acw/shared'
import { fuzzyMatch } from '@acw/shared'
import {
  createSessionFromGroup,
  createSessionFromMember,
  archiveSession,
  unarchiveSession,
  handleGateAction,
  postUserMessage,
  advance,
  refreshSessionAnnouncement,
  saveSessionAnnouncement,
  requestArchiveConsent,
  processDueArchives,
  restartFromNode,
  markInterruptedOnBoot,
  resolveInterruptedSession,
  pruneIdleOffsitePlaceholders,
  dismissPendingArchiveIfAny,
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

function finalizeMemberScript(script) {
  const enriched = enrichScriptConfig(script || {})
  assertScriptWorkDirConfigured(enriched)
  return enriched
}

export function createMember(body) {
  const id = uid('mem')
  const t = nowIso()
  const config = body.config || {}
  const kind = body.kind || MEMBER_KIND.ECHO
  if (kind === MEMBER_KIND.SCRIPT) {
    const raw = body.script || config.script
    if (!raw) throw new Error('脚本成员须配置运行方式')
    config.script = finalizeMemberScript(raw)
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
    const kindPre = body.kind || src.kind
    if (kindPre === MEMBER_KIND.SCRIPT && config.script) {
      config.script = finalizeMemberScript(config.script)
    }
  } else if (body.kind === MEMBER_KIND.SCRIPT || src.kind === MEMBER_KIND.SCRIPT) {
    if (body.script) {
      config = { ...config, script: finalizeMemberScript(body.script) }
    }
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
    if (s.adapt === true || s.adapt === 'true' || s.adapt === 1) {
      row.adapt = true
    }
    if (s.refine === true || s.refine === 'true' || s.refine === 1) {
      row.refine = true
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
  let session = sessionRow(getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id))
  if (!session) return null
  // 清旧版预挂的空闲场外占位；顺手关掉旧归档确认闸门
  try {
    if (session.status !== 'archived') {
      pruneIdleOffsitePlaceholders(id)
      dismissPendingArchiveIfAny(id)
      session = sessionRow(getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id)) || session
    }
  } catch {
    /* ignore */
  }
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

// —— 4.6 聊天消息模糊搜索 ——

const SEARCH_HITS_MAX = 200
const SEARCH_HITS_PER_SESSION = 20

/** 从一条消息 content 里取可搜索文本（text 字段 / choices 数组 / 纯字符串） */
function messageText(m) {
  const c = m.content
  if (c == null) return ''
  if (typeof c === 'string') return c
  let out = ''
  if (typeof c.text === 'string') out += c.text
  else if (c.text && typeof c.text === 'object' && typeof c.text.text === 'string') {
    out += c.text.text
  }
  if (Array.isArray(c.choices)) {
    const parts = c.choices
      .filter(Boolean)
      .map((ch) => {
        if (typeof ch === 'string') return ch
        if (typeof ch?.text === 'string') return ch.text
        return ''
      })
      .filter(Boolean)
    if (parts.length) out += (out ? '\n' : '') + parts.join('\n')
  }
  return out
}

/**
 * 聊天消息模糊搜索（4.6）。匹配 content.text / content.choices 里的文案。
 * @param {string} query
 * @param {{ sessionId?: string }} [opts] 指定会话则只搜该会话，否则全库
 * @returns {{ q, hits: Array<{ sessionId, sessionTitle, nodeInstanceId, messageId, role, memberId, memberName, snippet, at }> }}
 */
export function searchMessages(query, opts = {}) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return { q: String(q || ''), hits: [] }
  const { sessionId } = opts || {}
  const hits = []

  const memberName = (() => {
    const rows = getDb().prepare('SELECT id, display_name FROM members').all()
    const map = new Map(rows.map((r) => [r.id, r.display_name]))
    return (mid) => (mid ? map.get(mid) || '' : '')
  })()

  const collect = (s, rows) => {
    for (const m of rows) {
      if (hits.length >= SEARCH_HITS_MAX) return
      const text = messageText({ ...m, content: parseJson(m.content_json, {}) })
      if (!text) continue
      let bestAt = -1
      let bestSnippet = ''
      const lines = text.split(/\r?\n/)
      let matchedAny = false
      for (let i = 0; i < lines.length; i++) {
        if (!fuzzyMatch(q, lines[i], 50)) continue
        matchedAny = true
        const raw = lines[i].trim()
        const at = raw.toLowerCase().indexOf(q)
        const from = Math.max(0, Math.floor((at < 0 ? 0 : at) - 160 / 2))
        const snippet = raw.slice(from, from + 160)
        // 分数取该文本块最优（此处以行序近似；命中即认为满足阈值）
        if (bestSnippet === '') bestSnippet = snippet
        bestAt = i
        break
      }
      if (!matchedAny) continue
      hits.push({
        sessionId: s.id,
        sessionTitle: s.title,
        nodeInstanceId: m.node_instance_id || null,
        messageId: m.id,
        role: m.role,
        memberId: m.member_id || null,
        memberName: memberName(m.member_id),
        snippet: bestSnippet,
        at: bestAt,
      })
    }
  }

  if (sessionId) {
    const s = getDb().prepare('SELECT id, title FROM sessions WHERE id = ?').get(sessionId)
    if (!s) return { q, hits: [] }
    const rows = getDb()
      .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC')
      .all(sessionId)
    collect(s, rows)
    return { q, hits: hits.slice(0, SEARCH_HITS_PER_SESSION) }
  }

  const sessions = getDb().prepare('SELECT id, title FROM sessions ORDER BY updated_at DESC').all()
  for (const s of sessions) {
    if (hits.length >= SEARCH_HITS_MAX) break
    const rows = getDb()
      .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC')
      .all(s.id)
    let before = hits.length
    collect(s, rows)
    // 每会话最多 SEARCH_HITS_PER_SESSION 条
    if (hits.length - before > SEARCH_HITS_PER_SESSION) {
      hits.length = before + SEARCH_HITS_PER_SESSION
    }
  }
  return { q, hits }
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
  const row = getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id)
  if (!row) return { deleted: false }
  try {
    killSessionProcesses(id)
  } catch {
    /* ignore */
  }
  const db = getDb()
  db.prepare('DELETE FROM messages WHERE session_id = ?').run(id)
  db.prepare('DELETE FROM node_instances WHERE session_id = ?').run(id)
  try {
    db.prepare('DELETE FROM terminal_sessions WHERE session_id = ?').run(id)
  } catch {
    /* 旧库可能还没有这张表 */
  }
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id)
  if (row.group_id) {
    const remaining = db.prepare('SELECT COUNT(*) AS c FROM sessions WHERE group_id = ?').get(row.group_id)
    if (!remaining?.c) {
      const g = getGroup(row.group_id)
      if (g?.config?.adhoc) {
        db.prepare('DELETE FROM groups WHERE id = ?').run(row.group_id)
      }
    }
  }
  return { deleted: true }
}

export {
  createSessionFromGroup,
  createSessionFromMember,
  archiveSession,
  unarchiveSession,
  handleGateAction,
  postUserMessage,
  refreshSessionAnnouncement,
  saveSessionAnnouncement,
  requestArchiveConsent,
  processDueArchives,
  advance,
  restartFromNode,
  markInterruptedOnBoot,
  resolveInterruptedSession,
}
