import { contextBridge, ipcRenderer, webFrame } from 'electron'

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
})
