/** Node change summary / patch rendering for FlowRail (FE-01 extract from FlowRail.vue). */
import { formatStepChangeSummary } from '@acw/shared'
import { t } from '../../../i18n/index.js'
import { flowRailDiffTruncatedSuffix } from './flowRailCopy.js'

function adaptMetaFromNode(n) {
  const o = n?.output
  const i = n?.input
  const bag =
    o && typeof o === 'object' && (o.adaptFallback != null || o.adaptReason)
      ? o
      : i && typeof i === 'object'
        ? i
        : null
  return bag
}

export function flowRailNodeAdaptHint(n) {
  const bag = adaptMetaFromNode(n)
  if (!bag) return ''
  if (bag.adaptFallback) {
    const reason = bag.adaptReason ? String(bag.adaptReason).trim() : ''
    return reason
      ? `${t('workbench.flowRail.adaptFallback')}（${reason}）`
      : t('workbench.flowRail.adaptFallback')
  }
  if (bag.adapt === true && bag.adaptReason) {
    return `${t('workbench.flowRail.adaptOk')}（${String(bag.adaptReason)}）`
  }
  return ''
}

export function flowRailNodeChangeSummary(n) {
  return formatStepChangeSummary(n?.output?.changeSnapshot)
}

export function flowRailNodeChangePatch(n) {
  const cs = n?.output?.changeSnapshot
  if (!cs?.patch) return ''
  return `${cs.patch}${cs.patchTruncated ? `\n\n${flowRailDiffTruncatedSuffix()}` : ''}`
}
