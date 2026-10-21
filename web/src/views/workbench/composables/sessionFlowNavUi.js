/** Skipped-flow group expand state (FE-01 / sessionFlowUi companion). */

export function isSkippedFlowGroupExpanded(store, entry) {
  const key = entry?.key
  if (!key) return false
  return !!store?.expandedSkippedFlowGroups?.[key]
}

export function nextSkippedFlowGroupExpansion(store, entry) {
  const key = entry?.key
  if (!key) return store?.expandedSkippedFlowGroups || {}
  const open = isSkippedFlowGroupExpanded(store, entry)
  return {
    ...(store?.expandedSkippedFlowGroups || {}),
    [key]: !open,
  }
}
