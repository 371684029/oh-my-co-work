// CommonJS on purpose (5.1.0 DESK-01): the window runs with `sandbox: true`, and
// sandboxed preload scripts do not support ESM. A `.js` preload would be treated
// as ESM (root package.json declares "type": "module") and fail to load, silently
// dropping `window.__ACW_DESKTOP_API__` (notifications / tray / zoom / updates).
// API surface is identical to the previous preload.js.
const { contextBridge, ipcRenderer, webFrame } = require('electron')

contextBridge.exposeInMainWorld('__ACW_DESKTOP_ENV__', 'electron')

contextBridge.exposeInMainWorld('__ACW_DESKTOP_API__', {
  notify: (title, options) => ipcRenderer.invoke('acw:notify', { title, options }),
  minimizeToTray: () => ipcRenderer.invoke('acw:minimize-to-tray'),
  launchWorkflow: (sessionId) => ipcRenderer.invoke('acw:launch-workflow', sessionId),
  getZoom: () => webFrame.getZoomFactor(),
  setZoom: (factor) => {
    const f = Math.min(2, Math.max(0.5, Number(factor) || 1))
    webFrame.setZoomFactor(f)
    return f
  },
  applyDesktopUpdate: (manifest) => ipcRenderer.invoke('acw:apply-desktop-update', manifest),
  readClipboard: () => ipcRenderer.invoke('acw:clipboard-read'),
  writeClipboard: (text) => ipcRenderer.invoke('acw:clipboard-write', text),
  setTrayStatus: (payload) => ipcRenderer.invoke('acw:tray-status', payload || {}),
  onZoomMenu: (handler) => {
    if (typeof handler !== 'function') return
    ipcRenderer.on('acw:zoom-menu', (_event, payload) => handler(payload || {}))
  },
  onNotificationAction: (handler) => {
    if (typeof handler !== 'function') return
    ipcRenderer.on('acw:notification-action', (_event, payload) => handler(payload || {}))
  },
})
