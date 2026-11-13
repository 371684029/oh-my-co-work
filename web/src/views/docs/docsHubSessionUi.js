/** DocsHub session tree expand/collapse (FE-01). */

import { docsGroupKey } from './docsHubFilterUi.js'

export function isDocsSessionExpanded(expandedSessions, id) {
  return expandedSessions?.[id] !== false
}

export function toggleDocsSessionExpansion(expandedSessions, id) {
  return {
    ...(expandedSessions || {}),
    [id]: !isDocsSessionExpanded(expandedSessions, id),
  }
}

export function isDocsGroupExpanded(expandedGroups, id) {
  return expandedGroups?.[id] !== false
}

export function toggleDocsGroupExpansion(expandedGroups, id) {
  return {
    ...(expandedGroups || {}),
    [id]: !isDocsGroupExpanded(expandedGroups, id),
  }
}

/** @returns {{ expandedGroups: object, expandedSessions: object } | null} */
export function docsExpandSessionInTree(groups, sessionId, expandedSessions, expandedGroups) {
  for (const g of groups || []) {
    if ((g.sessions || []).some((s) => s.sessionId === sessionId)) {
      const gKey = docsGroupKey(g)
      return {
        expandedGroups: { ...(expandedGroups || {}), [gKey]: true },
        expandedSessions: { ...(expandedSessions || {}), [sessionId]: true },
      }
    }
  }
  return null
}
