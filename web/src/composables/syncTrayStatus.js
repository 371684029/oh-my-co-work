/** Push pending-action count to Electron tray (5.4.0 NTF-07). */

export function syncTrayStatus({ pending = 0, status = 'idle' } = {}) {
  const api = typeof window !== 'undefined' ? window.__ACW_DESKTOP_API__ : null
  if (!api?.setTrayStatus) return
  void api.setTrayStatus({ pending: Math.max(0, Number(pending) || 0), status })
}
