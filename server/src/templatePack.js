/**
 * 5.3.0 REU-01 — 配置级模板包（单 JSON），区别于整库备份。
 */
import os from 'node:os'
import { getMember, getGroup, createMember, createGroup, listMembers, listGroups } from './services.js'

export const TEMPLATE_PACK_VERSION = 1

const WIN_ABS = /^[A-Za-z]:[\\/]/
const POSIX_ABS = /^\//

function isAbsPath(p) {
  const s = String(p || '').trim()
  return WIN_ABS.test(s) || POSIX_ABS.test(s)
}

const TEMPLATE_VAR_RE = /\{\{(WORKSPACE|HOME|workspace|home)\}\}/g

/** Import-time substitution (5.3.0 REU-02). */
export function resolveTemplateVars(value, vars = {}) {
  const home = String(vars.home || os.homedir())
  const workspace = String(vars.workspace || process.cwd())
  const sub = (_match, key) => {
    const k = String(key || '').toLowerCase()
    return k === 'home' ? home : workspace
  }
  if (value == null) return value
  if (typeof value === 'string') return value.replace(TEMPLATE_VAR_RE, sub)
  if (Array.isArray(value)) return value.map((v) => resolveTemplateVars(v, vars))
  if (typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = resolveTemplateVars(v, vars)
    return out
  }
  return value
}

/** 导出前将绝对路径替换为占位符，便于跨机器导入。 */
export function parametrizePaths(value) {
  if (value == null) return value
  if (typeof value === 'string') {
    return isAbsPath(value) ? '{{WORKSPACE}}' : value
  }
  if (Array.isArray(value)) return value.map((v) => parametrizePaths(v))
  if (typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = parametrizePaths(v)
    return out
  }
  return value
}

function stripMemberForExport(m) {
  if (!m) return null
  return parametrizePaths({
    sourceMemberId: m.id,
    name: m.name,
    displayName: m.display_name || m.displayName,
    kind: m.kind,
    workFolder: m.work_folder || m.workFolder || null,
    config: m.config || {},
    enabled: m.enabled !== false,
  })
}

function stripGroupForExport(g) {
  if (!g) return null
  return parametrizePaths({
    title: g.title,
    description: g.description || '',
    workFolder: g.work_folder || g.workFolder || null,
    steps: g.steps || [],
    config: g.config || {},
    enabled: g.enabled !== false,
  })
}

function memberIdsFromSteps(steps) {
  const ids = new Set()
  for (const s of steps || []) {
    if (s?.memberId) ids.add(s.memberId)
  }
  return [...ids]
}

export function exportMemberTemplate(memberId) {
  const m = getMember(memberId)
  if (!m) throw new Error('成员不存在')
  return {
    acwTemplatePack: TEMPLATE_PACK_VERSION,
    kind: 'member',
    exportedAt: new Date().toISOString(),
    member: stripMemberForExport(m),
    members: [],
    group: null,
  }
}

export function exportGroupTemplate(groupId) {
  const g = getGroup(groupId)
  if (!g) throw new Error('群模板不存在')
  const memberIds = memberIdsFromSteps(g.steps)
  const members = memberIds.map((id) => stripMemberForExport(getMember(id))).filter(Boolean)
  return {
    acwTemplatePack: TEMPLATE_PACK_VERSION,
    kind: 'group',
    exportedAt: new Date().toISOString(),
    group: stripGroupForExport(g),
    members,
    member: null,
  }
}

function findNameConflict(kind, name, title) {
  if (kind === 'member') {
    const hit = listMembers({ includeDemo: true }).find((m) => m.name === name)
    return hit ? { type: 'member', id: hit.id, name: hit.name } : null
  }
  const hit = listGroups({ includeDemo: true, includeAdhoc: true }).find((g) => g.title === title)
  return hit ? { type: 'group', id: hit.id, title: hit.title } : null
}

/**
 * @param {'rename'|'skip'|'overwrite'} onConflict
 */
export function importTemplatePack(raw, { onConflict = 'rename', vars = null } = {}) {
  let pack =
    typeof raw === 'string'
      ? JSON.parse(raw)
      : raw
  if (!pack || pack.acwTemplatePack !== TEMPLATE_PACK_VERSION) {
    throw new Error('不支持的模板包版本')
  }
  if (vars && typeof vars === 'object') {
    pack = resolveTemplateVars(pack, vars)
  }

  const created = { members: [], groups: [] }
  const memberIdMap = new Map()

  const importOneMember = (body, { forceName } = {}) => {
    const name = forceName || body.name
    const conflict = findNameConflict('member', name)
    if (conflict && onConflict === 'skip') {
      if (body.sourceMemberId) memberIdMap.set(body.sourceMemberId, conflict.id)
      return { skipped: true, id: conflict.id, sourceMemberId: body.sourceMemberId }
    }
    let useName = name
    if (conflict && onConflict === 'rename') {
      useName = `${name}_import_${Date.now()}`
    }
    if (conflict && onConflict === 'overwrite') {
      throw new Error(`覆盖导入尚未支持: 成员 ${name}`)
    }
    const row = createMember({
      name: useName,
      displayName: body.displayName || body.display_name || useName,
      kind: body.kind,
      workFolder: body.workFolder || body.work_folder || null,
      config: body.config || {},
    })
    created.members.push(row.id)
    return { skipped: false, id: row.id, row, sourceMemberId: body.sourceMemberId }
  }

  for (const m of pack.members || []) {
    const r = importOneMember(m)
    if (!r.skipped && r.sourceMemberId) memberIdMap.set(r.sourceMemberId, r.id)
  }

  if (pack.kind === 'member' && pack.member) {
    const r = importOneMember(pack.member)
    if (!r.skipped) created.members.push(r.id)
    return { ...created, primaryId: r.id, kind: 'member' }
  }

  if (pack.kind === 'group' && pack.group) {
    const g = pack.group
    const title = g.title || '导入的群模板'
    const conflict = findNameConflict('group', null, title)
    if (conflict && onConflict === 'skip') {
      return { ...created, skipped: true, primaryId: conflict.id, kind: 'group' }
    }
    let useTitle = title
    if (conflict && onConflict === 'rename') {
      useTitle = `${title} (导入)`
    }
    if (conflict && onConflict === 'overwrite') {
      throw new Error(`覆盖导入尚未支持: 群 ${title}`)
    }
    const steps = (g.steps || []).map((s) => {
      const step = { ...s }
      if (step.memberId && memberIdMap.has(step.memberId)) {
        step.memberId = memberIdMap.get(step.memberId)
      }
      return step
    })

    const row = createGroup({
      title: useTitle,
      description: g.description,
      workFolder: g.workFolder || g.work_folder || null,
      steps,
      config: g.config,
    })
    created.groups.push(row.id)
    return { ...created, primaryId: row.id, kind: 'group' }
  }

  throw new Error('模板包缺少 member 或 group 数据')
}
