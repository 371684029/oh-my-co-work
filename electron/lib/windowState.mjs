/**
 * 桌面窗口首次打开铺满屏幕（最大化 + 系统全屏）。
 * 抽出来给 node:test 锁契约，避免只在 Electron 里才看得到。
 */
export function applyDesktopOpenState(win) {
  if (!win) return false
  if (typeof win.maximize === 'function') win.maximize()
  if (typeof win.setFullScreen === 'function') win.setFullScreen(true)
  return true
}
