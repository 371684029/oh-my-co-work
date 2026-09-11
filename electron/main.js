import { app, BrowserWindow, Notification, Tray, Menu, globalShortcut, ipcMain } from 'electron'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
let mainWindow = null
let tray = null
let isQuitting = false

function createTray() {
  if (tray) return
  const iconPath = path.join(__dirname, '../web/src/assets/furnace-idle.png')
  try {
    tray = new Tray(iconPath)
    tray.setToolTip('oh-my-co-work · 终端守护者')

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '打开工作台',
        click: () => {
          if (mainWindow) {
            mainWindow.show()
            mainWindow.focus()
          }
        },
      },
      {
        label: '隐藏到托盘',
        click: () => {
          if (mainWindow) mainWindow.hide()
        },
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          isQuitting = true
          app.quit()
        },
      },
    ])

    tray.setContextMenu(contextMenu)
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show()
        mainWindow.focus()
      }
    })
  } catch {
    /* 无图形界面或打包虚拟环境下静默处理 */
  }
}

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

  // 点击窗口关闭按钮 X 时，藏到托盘而不是直接彻底退出
  mainWindow.on('close', (evt) => {
    if (!isQuitting) {
      evt.preventDefault()
      mainWindow.hide()
    }
  })

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

ipcMain.handle('acw:apply-desktop-update', (_evt, manifest) => {
  // 预留桌面静默自更新处理句柄
  return !!manifest
})

ipcMain.handle('acw:minimize-to-tray', () => {
  if (mainWindow) {
    mainWindow.hide()
    return true
  }
  return false
})

ipcMain.handle('acw:launch-workflow', (_evt, sessionIdOrGroupId) => {
  if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
    const targetUrl = `http://127.0.0.1:3780/#/workbench?session=${encodeURIComponent(sessionIdOrGroupId || '')}`
    mainWindow.loadURL(targetUrl).catch(() => {})
    return true
  }
  return false
})

function registerGlobalHotkeys() {
  const hotkey = process.platform === 'darwin' ? 'Option+Space' : 'Alt+Space'
  try {
    globalShortcut.register(hotkey, () => {
      if (mainWindow) {
        if (mainWindow.isVisible() && mainWindow.isFocused()) {
          mainWindow.hide()
        } else {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    })
  } catch {
    /* 快捷键占用或非 GUI 命令行测试场景静默处理 */
  }
}

app.whenReady().then(() => {
  createMainWindow()
  createTray()
  registerGlobalHotkeys()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
