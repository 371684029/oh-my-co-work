/**
 * Furnace tool focus: active / paused / none.
 * The pin lives in active.json so workflow refreshes can redraw ACTIVE.md
 * without dropping the member the user is editing.
 */
import fs from 'node:fs'
import path from 'node:path'
import { FURNACE_ROLE } from '@acw/shared'
import { collectAdaptSourcePaths } from './adaptBackup.js'
import {
  activateFurnaceRole,
  currentFurnaceRole,
  furnaceHomeDir,
  readFurnaceActiveFile,
} from './furnaceContext.js'
import { maybeInjectGrokFurnace } from './furnaceGrokInject.js'
import { formatVerifyFailureBrief } from './refineVerifyPrompt.js'

function remember(pin) {
  if (!pin?.memberId) return null
  return {
    memberId: pin.memberId,
    displayName: pin.displayName || pin.memberId,
    filePath: pin.filePath || '',
    workDir: pin.workDir || '',
    command: pin.command || '',
  }
}

/**
 * Pure transition. Does not touch disk.
 * @param {{ toolPin?: object, lastTool?: object }} prev
 * @param {'bind'|'pause'|'clear'|'resume'|'open-free'} action
 * @param {object|null} snapshot member fields for bind
 */
export function nextFurnaceFocus(prev, action, snapshot = null) {
  const pin =
    prev?.toolPin && typeof prev.toolPin === 'object'
      ? { ...prev.toolPin }
      : { stance: 'none', generation: 0 }
  const generation = Number(pin.generation) || 0
  let lastTool = prev?.lastTool || null

  if (action === 'pause') {
    if (!pin.memberId || pin.stance === 'none') {
      return { toolPin: { ...pin, stance: 'none', generation }, lastTool }
    }
    return { toolPin: { ...pin, stance: 'paused', generation }, lastTool }
  }

  if (action === 'clear') {
    if (pin.memberId) lastTool = remember(pin)
    return {
      toolPin: { stance: 'none', generation, memberId: null },
      lastTool,
    }
  }

  if (action === 'open-free') {
    if ((pin.stance === 'active' || pin.stance === 'paused') && pin.memberId) {
      lastTool = remember(pin)
    }
    return {
      toolPin: { stance: 'none', generation, memberId: null },
      lastTool,
    }
  }

  if (action === 'resume') {
    const src = pin.stance === 'paused' && pin.memberId ? pin : lastTool
    if (!src?.memberId) {
      const err = new Error('没有可继续改的工具')
      err.code = 'NO_TOOL'
      throw err
    }
    const same = pin.memberId === src.memberId
    return {
      toolPin: {
        ...pin,
        ...src,
        stance: 'active',
        generation: same ? generation : generation + 1,
      },
      lastTool: null,
    }
  }

  if (action === 'bind') {
    if (!snapshot?.memberId) {
      const err = new Error('缺少成员')
      err.code = 'NO_MEMBER'
      throw err
    }
    if (!snapshot.filePath && !snapshot.command) {
      const err = new Error('这个成员还没有脚本路径')
      err.code = 'NO_PATH'
      throw err
    }
    const same = pin.memberId === snapshot.memberId && pin.stance !== 'none'
    return {
      toolPin: {
        ...snapshot,
        stance: 'active',
        generation: same ? generation : generation + 1,
      },
      lastTool: null,
    }
  }

  const err = new Error(`未知熔炉姿态动作: ${action}`)
  err.code = 'BAD_ACTION'
  throw err
}

function refineLabel(member, draft) {
  const saved = !!member?.config?.refine?.enabled
  const checked = draft && Object.prototype.hasOwnProperty.call(draft, 'refine') ? !!draft.refine : saved
  if (checked && !saved) return '已勾选未保存'
  if (saved) return '已开启'
  return '未开启'
}

function verifyLine(member) {
  const last = member?.config?.refine?.verifyLast
  if (!last || last.stale) return '无'
  if (last.ok) return '通过'
  const brief = formatVerifyFailureBrief(member, last)
  return brief ? `失败 ${brief.split('\n')[0]}` : '失败'
}

function snapshotFromMember(member, draft = {}) {
  const script = {
    ...(member?.config?.script || {}),
  }
  if (draft.filePath) script.filePath = draft.filePath
  if (draft.workDir) {
    script.scriptWorkDir = draft.workDir
    script.scriptDir = draft.workDir
  }
  if (draft.command) script.command = draft.command
  const shaped = { ...member, config: { ...(member?.config || {}), script } }
  const files = collectAdaptSourcePaths(shaped)
  const filePath = String(files[0] || draft.filePath || script.filePath || script.path || '').trim()
  const command = String(draft.command || script.command || '').trim()
  const savedEnabled = !!member?.config?.refine?.enabled
  const unsaved =
    draft.unsaved === true ||
    (Object.prototype.hasOwnProperty.call(draft, 'refine') && !!draft.refine !== savedEnabled) ||
    (draft.filePath && draft.filePath !== (member?.config?.script?.filePath || ''))
  return {
    memberId: member.id,
    displayName: String(draft.displayName || member.display_name || member.name || member.id),
    filePath,
    command,
    workDir: String(draft.workDir || script.scriptWorkDir || script.scriptDir || member.work_folder || '').trim(),
    files,
    refineLabel: refineLabel(member, draft),
    verifyLine: verifyLine(member),
    unsaved: !!unsaved,
  }
}

function writeFocus(next) {
  const home = furnaceHomeDir()
  const activeJson = path.join(home, 'active.json')
  const prev = readFurnaceActiveFile()
  const merged = {
    ...prev,
    toolPin: next.toolPin,
    lastTool: next.lastTool,
    seenBy: prev.seenBy && typeof prev.seenBy === 'object' ? prev.seenBy : {},
  }
  delete merged.armFree
  fs.mkdirSync(home, { recursive: true })
  fs.writeFileSync(activeJson, JSON.stringify(merged, null, 2), 'utf8')
}

/** Active tool keeps the refine role unless a review gate is in progress. */
export function furnaceRoleForPin(requestedRole, pin) {
  if (pin?.stance === 'active' && pin.memberId && requestedRole !== FURNACE_ROLE.REVIEW) {
    return FURNACE_ROLE.REFINE
  }
  return requestedRole
}

function roleForStance(stance) {
  const cur = currentFurnaceRole()
  if (stance === 'active') return FURNACE_ROLE.REFINE
  if (cur === FURNACE_ROLE.REVIEW) return FURNACE_ROLE.REVIEW
  return FURNACE_ROLE.SESSION
}

function redraw(stance) {
  const prev = readFurnaceActiveFile()
  let situation = ''
  try {
    situation = fs.readFileSync(path.join(furnaceHomeDir(), 'SITUATION.md'), 'utf8')
  } catch {
    situation = ''
  }
  const pack = activateFurnaceRole(roleForStance(stance), {
    sessionId: prev.sessionId || null,
    nodeId: prev.nodeId || null,
    situation,
  })
  try {
    pack.grok = maybeInjectGrokFurnace(pack)
  } catch {
    /* rules file is optional; ACTIVE.md is the binding */
  }
  return pack
}

export function publicFurnaceFocus(meta = readFurnaceActiveFile()) {
  const pin = meta.toolPin && typeof meta.toolPin === 'object' ? meta.toolPin : { stance: 'none' }
  const last = meta.lastTool || null
  return {
    stance: pin.stance || 'none',
    memberId: pin.memberId || '',
    displayName: pin.displayName || '',
    filePath: pin.filePath || '',
    workDir: pin.workDir || '',
    generation: Number(pin.generation) || 0,
    unsaved: !!pin.unsaved,
    lastTool: last,
    seenBy: meta.seenBy && typeof meta.seenBy === 'object' ? meta.seenBy : {},
  }
}

export async function applyFurnaceFocus(body = {}, deps = {}) {
  const action = String(body.action || '').trim()
  const prev = readFurnaceActiveFile()
  if (action === 'arm-free' || action === 'disarm-free') {
    const home = furnaceHomeDir()
    const next = { ...prev }
    if (action === 'arm-free') next.armFree = true
    else delete next.armFree
    fs.mkdirSync(home, { recursive: true })
    fs.writeFileSync(path.join(home, 'active.json'), JSON.stringify(next, null, 2), 'utf8')
    return publicFurnaceFocus(next)
  }
  let snapshot = null
  if (action === 'bind' || action === 'resume') {
    const memberId = String(body.memberId || prev.toolPin?.memberId || prev.lastTool?.memberId || '').trim()
    if (action === 'bind') {
      const getMember = deps.getMember || (await import('./services.js')).getMember
      const member = getMember(memberId)
      if (!member) {
        const err = new Error('成员不存在')
        err.code = 'NOT_FOUND'
        throw err
      }
      snapshot = snapshotFromMember(member, body.draft || {})
    }
  }
  const next = nextFurnaceFocus(prev, action, snapshot)
  if (action === 'resume' && next.toolPin?.memberId && !next.toolPin.filePath && !next.toolPin.command) {
    const getMember = deps.getMember || (await import('./services.js')).getMember
    const member = getMember(next.toolPin.memberId)
    if (member) {
      const filled = snapshotFromMember(member, {})
      next.toolPin = { ...filled, stance: 'active', generation: next.toolPin.generation }
    }
  }
  writeFocus(next)
  redraw(next.toolPin.stance || 'none')
  return publicFurnaceFocus()
}

export function stampFurnaceSeen(agent) {
  const kind = agent === 'cursor' ? 'cursor' : 'grok'
  const prev = readFurnaceActiveFile()
  const pin = prev.toolPin && typeof prev.toolPin === 'object' ? prev.toolPin : { stance: 'none' }
  const seenBy = prev.seenBy && typeof prev.seenBy === 'object' ? { ...prev.seenBy } : {}
  seenBy[kind] = {
    memberId: pin.stance === 'none' ? null : pin.memberId || null,
    generation: Number(pin.generation) || 0,
    stance: pin.stance || 'none',
  }
  const home = furnaceHomeDir()
  fs.mkdirSync(home, { recursive: true })
  fs.writeFileSync(
    path.join(home, 'active.json'),
    JSON.stringify({ ...prev, seenBy }, null, 2),
    'utf8',
  )
  return seenBy[kind]
}
