/** System/status lines that represent archive completion (hidden from main bubble stream). */
export function isArchiveStatusMessage(m, text = '') {
  if (!m) return false
  const t = text || ''
  if (m.type === 'status' && /归档/.test(t)) return true
  return m.role === 'system' && /任务已.*归档|自动归档|已归档/.test(t)
}
