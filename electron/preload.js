import { contextBridge, ipcRenderer } from 'electron'

// 向 Vue 前端窗口暴露标准的 ACW 桌面 Bridge 句柄
contextBridge.exposeInMainWorld('__ACW_DESKTOP_ENV__', 'electron')

contextBridge.exposeInMainWorld('__ACW_DESKTOP_API__', {
  notify: (title, options) => ipcRenderer.invoke('acw:notify', { title, options }),
  minimizeToTray: () => ipcRenderer.invoke('acw:minimize-to-tray'),
  launchWorkflow: (sessionId) => ipcRenderer.invoke('acw:launch-workflow', sessionId),
  applyDesktopUpdate: (manifest) => ipcRenderer.invoke('acw:apply-desktop-update', manifest),
})
