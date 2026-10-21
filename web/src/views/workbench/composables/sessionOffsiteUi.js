/** 是否正处在场外协助（已归档则不算活跃） */
export function computeOffsiteActive(session, nodes) {
  if (!session || session.status === 'archived') return false
  const ctx = session.context && typeof session.context === 'object' ? session.context : {}
  if (ctx.offsiteAssist?.archived && ctx.offsiteAssist?.active === false) return false
  if (ctx.offsiteAssist?.active) return true
  return (nodes || []).some(
    (n) =>
      n.step_type === 'offsite' &&
      !n.output?.archived &&
      (n.status === 'running' || n.status === 'waiting_human'),
  )
}

export function findActiveOffsiteNode(nodes, sessionContext) {
  const ctx = sessionContext
  const pinned = ctx?.offsiteAssist?.active ? ctx.offsiteAssist?.nodeInstanceId : null
  if (pinned) {
    const hit = (nodes || []).find(
      (n) => n.id === pinned && n.step_type === 'offsite' && !n.output?.archived,
    )
    if (hit) return hit
  }
  return (
    (nodes || []).find(
      (n) =>
        n.step_type === 'offsite' &&
        !n.output?.archived &&
        (n.status === 'running' || n.status === 'waiting_human'),
    ) || null
  )
}

/** @returns {'planned' | 'interrupt' | null} */
export function computeOffsiteMode(sessionContext, activeNode, offsiteActive) {
  const ctx = sessionContext
  if (ctx?.offsiteAssist?.mode === 'planned' || ctx?.offsiteAssist?.planned) return 'planned'
  const n = activeNode
  if (n?.output?.mode === 'planned' || n?.output?.plannedPause) return 'planned'
  if (offsiteActive) return 'interrupt'
  return null
}

/** 多段场外并存时，仅高亮当前活跃段落 */
export function isCurrentOffsiteSegment(n, activeOffsiteNodeId) {
  if (!n || n.step_type !== 'offsite' || n.output?.archived) return false
  if (n.status !== 'running' && n.status !== 'waiting_human') return false
  return activeOffsiteNodeId === n.id
}

export function offsiteEntryLabel(n, { activeOffsiteNodeId, mode }) {
  if (!n || n.step_type !== 'offsite') return ''
  if (!isCurrentOffsiteSegment(n, activeOffsiteNodeId)) return ''
  const resolvedMode =
    n.output?.mode || (n.output?.plannedPause ? 'planned' : null) || mode
  if (resolvedMode === 'planned') return '计划'
  return '插队'
}

export function offsiteInvokedMembers(n) {
  if (!n || n.step_type !== 'offsite') return []
  const out = n.output || {}
  const names = []
  const seen = new Set()
  const collect = (list) => {
    for (const item of Array.isArray(list) ? list : []) {
      const name = String(item?.memberName || '').trim()
      if (name && !seen.has(name)) {
        seen.add(name)
        names.push(name)
      }
    }
  }
  for (const assist of Array.isArray(out.assists) ? out.assists : []) {
    collect(assist?.invoked)
  }
  collect(out.lastInvoked)
  return names
}

export function offsiteInvokedLabel(n) {
  const names = offsiteInvokedMembers(n)
  return names.length ? names.map((name) => `@${name}`).join('、') : ''
}
