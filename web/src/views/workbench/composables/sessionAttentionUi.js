/** Whether the session UI should highlight human-attention state. */
export function computeNeedsHuman(session, pendingGate) {
  if (!session) return false
  if (session.status === 'archived') return false
  if (session.status === 'waiting_human') return true
  if (session.status === 'interrupted') return true
  return !!pendingGate
}

export function announceKickoffFromContext(ctx) {
  const k = ctx?.kickoff
  return k && typeof k === 'object' ? String(k.text || '').trim() : ''
}

export function announceUserNotesFromContext(ctx) {
  const list = ctx?.userNotes
  if (!Array.isArray(list)) return []
  return list
    .filter((u) => u && String(u.text || '').trim())
    .map((u) => ({
      actionLabel: u.actionLabel || u.action || '附言',
      nodeTitle: u.nodeTitle || '',
      text: String(u.text).trim(),
    }))
}
