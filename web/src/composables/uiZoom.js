/**
 * UI zoom (5.2.0 UI-06): sync top bar, localStorage, Electron webFrame, keyboard.
 */

export const ZOOM_MIN = 0.6
export const ZOOM_MAX = 1.6
export const ZOOM_KEY = 'acw.uiZoom'

export function clampZoom(f) {
  return Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(f) || 1)) * 100) / 100
}

export function applyUiZoom(f) {
  const v = clampZoom(f)
  const api = typeof window !== 'undefined' ? window.__ACW_DESKTOP_API__ : null
  if (api?.setZoom) api.setZoom(v)
  else if (typeof document !== 'undefined') {
    document.documentElement.style.zoom = v === 1 ? '' : String(v)
  }
  return v
}

export function readStoredZoom() {
  try {
    const saved = Number(localStorage.getItem(ZOOM_KEY))
    if (saved >= ZOOM_MIN && saved <= ZOOM_MAX && saved !== 1) return saved
  } catch {
    /* ignore */
  }
  const api = typeof window !== 'undefined' ? window.__ACW_DESKTOP_API__ : null
  if (api?.getZoom) {
    const z = clampZoom(api.getZoom())
    if (z !== 1) return z
  }
  return 1
}

export function persistZoom(v) {
  try {
    localStorage.setItem(ZOOM_KEY, String(v))
  } catch {
    /* ignore */
  }
}

export function stepUiZoom(current, dir) {
  return clampZoom(current + dir * 0.1)
}

/** Register global zoom API for Electron menu IPC (UI-06). */
export function exposeUiZoomBridge({ getZoom, setZoom }) {
  if (typeof window === 'undefined') return
  window.__ACW_UI_ZOOM__ = {
    get: () => getZoom(),
    set: (f) => setZoom(f),
    step: (dir) => setZoom(stepUiZoom(getZoom(), dir)),
    reset: () => setZoom(1),
  }
}
