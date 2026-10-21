/** Session list bootstrap helpers (FE-01 pure logic). */

export function filterStartableMembers(members) {
  return (members || []).filter((m) => m.enabled !== false)
}

export function pickDefaultStartTarget(groups, members) {
  const g0 = groups?.[0]
  if (g0?.id) return `g:${g0.id}`
  const startable = filterStartableMembers(members)
  if (startable[0]?.id) return `m:${startable[0].id}`
  return ''
}

export function workbenchSessionRoute(sessionId) {
  const id = String(sessionId || '').trim()
  return id ? `/workbench/${id}` : '/workbench'
}

export function shouldSaveComposerDraftOnSessionSwitch(prevId, nextId) {
  return Boolean(prevId && nextId && prevId !== nextId)
}
