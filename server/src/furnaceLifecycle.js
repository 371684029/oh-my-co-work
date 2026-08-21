/**
 * 熔炉 Grok 进程：关闭 / 新开。
 * GUI「返回群聊」只关皮，PTY 还在，Grok 自己的对话会一直堆。
 * 要清上下文必须杀进程再 spawn 一条新 grok。
 */
import { getDb, parseJson } from './db.js'
import { isFurnaceMember, MEMBER_KIND } from '@acw/shared'
import { listMembers, getGroup } from './services.js'
import { runMember } from './runners.js'
import { syncFurnaceSessionContext } from './furnaceSituation.js'
import { killTerminal, listSessionTerminals } from './terminal/terminalService.js'
import { killMemberProcesses } from './processRegistry.js'

function furnaceMember() {
  return listMembers({ includeDemo: true }).find((m) => isFurnaceMember(m)) || null
}

function requireSession(sessionId) {
  const row = getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId)
  if (!row) throw new Error('会话不存在')
  return row
}

function furnaceNodeId(sessionId, memberId) {
  const nodes = getDb()
    .prepare(`SELECT * FROM node_instances WHERE session_id = ? ORDER BY step_index DESC`)
    .all(sessionId)
  if (!nodes.length) return null
  const hit = nodes.find((n) => parseJson(n.input_json, {}).memberId === memberId)
  return hit?.id || nodes[0].id
}

export function closeFurnace(sessionId) {
  requireSession(sessionId)
  const member = furnaceMember()
  if (!member) throw new Error('未找到熔炉成员')
  let killed = 0
  for (const t of listSessionTerminals(sessionId, { includeReplay: false })) {
    if (t.memberId && t.memberId !== member.id) continue
    if (t.memberId === member.id || isFurnaceMember({ display_name: t.label, name: t.label })) {
      if (killTerminal(t.id, 'furnace_close')) killed += 1
    }
  }
  try {
    const extra = killMemberProcesses(sessionId, member.id, { includeDetach: true })
    killed += Number(extra?.killed || 0)
  } catch {
    /* ignore */
  }
  return { ok: true, closed: true, killed }
}

export async function reopenFurnace(sessionId) {
  const session = requireSession(sessionId)
  const member = furnaceMember()
  if (!member) throw new Error('未找到熔炉成员')
  if (member.kind !== MEMBER_KIND.SCRIPT) {
    throw new Error('熔炉还没接到 Grok，请先在设置里打开 Grok Build')
  }
  const group = session.group_id ? getGroup(session.group_id) : null
  const ctx = parseJson(session.context_json, {})
  try {
    syncFurnaceSessionContext(sessionId, { keepRole: true })
  } catch (e) {
    console.warn('[acw] furnace reopen context', e?.message || e)
  }
  const nodeInstanceId = furnaceNodeId(sessionId, member.id)
  const result = await runMember(member, {
    group,
    sessionContext: {
      ...ctx,
      sessionTitle: session.title,
      params: ctx.params || {},
    },
    sessionId,
    nodeInstanceId,
    humanInput: ctx.lastHumanInput || null,
    params: ctx.params || {},
  })
  return {
    ok: !!result?.ok,
    summary: result?.summary || '',
    terminalId: result?.terminalId || result?.data?.terminalId || null,
    replaced: true,
  }
}
