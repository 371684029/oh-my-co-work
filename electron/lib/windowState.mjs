/**
 * Desktop window bounds + first-run open state (UX-06 / DSK-03).
 * Pure helpers are covered by node:test; Electron applies them in main.js.
 */

const MIN_WIDTH = 1024
const MIN_HEIGHT = 600

/**
 * @param {{ x?: number, y?: number, width?: number, height?: number }} bounds
 * @param {{ x?: number, y?: number, width?: number, height?: number }} workArea
 */
export function clampWindowBounds(bounds, workArea) {
  const wa = workArea || { x: 0, y: 0, width: 1920, height: 1080 }
  const width = Math.max(MIN_WIDTH, Number(bounds?.width) || MIN_WIDTH)
  const height = Math.max(MIN_HEIGHT, Number(bounds?.height) || MIN_HEIGHT)
  const maxW = Math.max(MIN_WIDTH, Number(wa.width) || width)
  const maxH = Math.max(MIN_HEIGHT, Number(wa.height) || height)
  const w = Math.min(width, maxW)
  const h = Math.min(height, maxH)
  const minX = Number(wa.x) || 0
  const minY = Number(wa.y) || 0
  const maxX = minX + maxW - w
  const maxY = minY + maxH - h
  let x = Number(bounds?.x)
  let y = Number(bounds?.y)
  if (!Number.isFinite(x)) x = minX + Math.round((maxW - w) / 2)
  if (!Number.isFinite(y)) y = minY + Math.round((maxH - h) / 2)
  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
    width: w,
    height: h,
  }
}

export function captureWindowBounds(win) {
  if (!win || typeof win.isDestroyed === 'function' && win.isDestroyed()) return null
  const b = typeof win.getBounds === 'function' ? win.getBounds() : null
  if (!b) return null
  return {
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    isMaximized: typeof win.isMaximized === 'function' ? win.isMaximized() : false,
    isFullScreen: typeof win.isFullScreen === 'function' ? win.isFullScreen() : false,
  }
}

/**
 * Apply stored bounds; returns false when no bounds (caller may use first-run maximize).
 */
export function applyStoredWindowBounds(win, stored, workArea) {
  if (!win || !stored || typeof stored !== 'object') return false
  const clamped = clampWindowBounds(stored, workArea)
  if (stored.isMaximized && typeof win.maximize === 'function') {
    win.maximize()
  } else if (typeof win.setBounds === 'function') {
    win.setBounds(clamped)
  }
  if (stored.isFullScreen && typeof win.setFullScreen === 'function') {
    win.setFullScreen(true)
  }
  return true
}

/** First run: maximize + fullscreen (legacy DESK behavior). */
export function applyDesktopOpenState(win) {
  if (!win) return false
  if (typeof win.maximize === 'function') win.maximize()
  if (typeof win.setFullScreen === 'function') win.setFullScreen(true)
  return true
}
