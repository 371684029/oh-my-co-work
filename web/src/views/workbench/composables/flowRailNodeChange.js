/** Node change summary / patch rendering for FlowRail (FE-01 extract from FlowRail.vue). */
import { formatStepChangeSummary } from '@acw/shared'
import { flowRailDiffTruncatedSuffix } from './flowRailCopy.js'

export function flowRailNodeChangeSummary(n) {
  return formatStepChangeSummary(n?.output?.changeSnapshot)
}

export function flowRailNodeChangePatch(n) {
  const cs = n?.output?.changeSnapshot
  if (!cs?.patch) return ''
  return `${cs.patch}${cs.patchTruncated ? `\n\n${flowRailDiffTruncatedSuffix()}` : ''}`
}
