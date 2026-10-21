/** Session destructive / id helpers (FE-01). */

export function resolveSessionId(targetId, activeId) {
  return typeof targetId === 'string' && targetId ? targetId : activeId
}
