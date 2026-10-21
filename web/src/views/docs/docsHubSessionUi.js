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

/** @returns {{ selectedGroupId: string, expandedSessions: object } | null} */
export function docsExpandSessionInTree(groups, sessionId, expandedSessions) {
  for (const g of groups || []) {
    if ((g.sessions || []).some((s) => s.sessionId === sessionId)) {
      return {
        selectedGroupId: docsGroupKey(g),
        expandedSessions: { ...(expandedSessions || {}), [sessionId]: true },
      }
    }
  }
  return null
}
