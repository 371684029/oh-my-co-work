/** Timeline category labels for FlowRail (DSK-08). */
import { t } from '../../../i18n/index.js'

const TIMELINE_CAT_KEYS = {
  node: 'workbench.flowRail.timeline.catNode',
  gate: 'workbench.flowRail.timeline.catGate',
  terminal: 'workbench.flowRail.timeline.catTerminal',
  docs: 'workbench.flowRail.timeline.catDocs',
  offsite: 'workbench.flowRail.timeline.catOffsite',
}

export function flowRailTimelineCatLabel(cat) {
  const key = TIMELINE_CAT_KEYS[cat]
  return key ? t(key) : cat || ''
}

export function flowRailTimelineFilterOptions() {
  return [
    { value: 'all', label: t('workbench.flowRail.timeline.filterAll') },
    { value: 'node', label: t('workbench.flowRail.timeline.filterNode') },
    { value: 'gate', label: t('workbench.flowRail.timeline.filterGate') },
    { value: 'terminal', label: t('workbench.flowRail.timeline.filterTerminal') },
    { value: 'docs', label: t('workbench.flowRail.timeline.filterDocs') },
    { value: 'offsite', label: t('workbench.flowRail.timeline.filterOffsite') },
  ]
}
