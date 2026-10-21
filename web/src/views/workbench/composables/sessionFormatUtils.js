/** FE-01: locale-safe time formatting for session UI. */

export function formatSessionTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return String(iso)
  }
}
