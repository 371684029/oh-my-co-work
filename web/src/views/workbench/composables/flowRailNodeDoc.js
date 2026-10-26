/** Node journal doc helpers for FlowRail (FE-01 extract from FlowRail.vue). */
import { journalPathToDocFile } from '../../../composables/messageDocLinks.js'

export function flowRailNodeDocFile(n) {
  return journalPathToDocFile(n?.journalPath)
}

export function flowRailOpenNodeJournal(n, { openDocsHub } = {}) {
  const file = flowRailNodeDocFile(n)
  if (!file) return
  openDocsHub({ file })
}
