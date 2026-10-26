/**
 * Push desktop status to the Electron tray (5.4.0 NTF-07).
 * `items` feeds the tray「待处理（最多 5 条）」submenu; `progress` (0..1) drives
 * the taskbar progress bar (NTF-08) — omit `progress` to leave it unchanged.
 */

export function syncTrayStatus({ pending = 0, status = 'idle', items, progress } = {}) {
  const api = typeof window !== 'undefined' ? window.__ACW_DESKTOP_API__ : null
  if (!api?.setTrayStatus) return
  const payload = { pending: Math.max(0, Number(pending) || 0), status }
  if (Array.isArray(items)) payload.items = items
  if (progress !== undefined) payload.progress = progress
  void api.setTrayStatus(payload)
}
