/** Demo flow group helpers (FE-01). */

export const DEMO_FLOW_GROUP_TITLE = '演示流'

export function findGroupByTitle(groups, title = DEMO_FLOW_GROUP_TITLE) {
  return (groups || []).find((g) => g.title === title) || null
}

export function demoFlowMissingMessage(t) {
  return t('workbench.demo.missingGroup')
}

export function demoFlowLoadFailedMessage(err, t) {
  return err?.message || t('workbench.demo.loadFailed')
}
