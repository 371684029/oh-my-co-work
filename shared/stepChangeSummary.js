/** Display helper for TRC-01 change snapshots. */
export function formatStepChangeSummary(change) {
  if (!change || change.mode !== 'git' || !change.filesChanged) return ''
  const ins = change.insertions ? `+${change.insertions}` : ''
  const del = change.deletions ? `−${change.deletions}` : ''
  const nums = [ins, del].filter(Boolean).join(' ')
  return `${change.filesChanged} 个文件${nums ? ` ${nums}` : ''}`
}
