import { app, BrowserWindow, Notification, ipcMain } from 'electron'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
let mainWindow = null

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'oh-my-co-work',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // 开发环境定位到 本地 Web/Vite 服务或静态产物
  const devUrl = process.env.ACW_DESKTOP_DEV_URL || 'http://127.0.0.1:3780'

  try {
    await mainWindow.loadURL(devUrl)
  } catch {
    // 静态产物备用地址
    const indexPath = path.join(__dirname, '../web/dist/index.html')
    mainWindow.loadFile(indexPath).catch(() => {})
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 注册 IPC 消息处理
ipcMain.handle('acw:notify', (_evt, { title, options }) => {
  if (Notification.isSupported()) {
    const notification = new Notification({ title, ...options })
    notification.show()
    return true
  }
  return false
})

ipcMain.handle('acw:minimize-to-tray', () => {
  if (mainWindow) {
    mainWindow.hide()
    return true
  }
  return false
})

app.whenReady().then(() => {
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
