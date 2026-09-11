import {
  app,
  BrowserWindow,
  Notification,
  Tray,
  Menu,
  ipcMain,
  dialog,
  nativeImage,
} from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { desktopUpdateResult, workbenchUrl } from './lib/urls.mjs'
import {
  isServerUp,
  resolveNodeBin,
  resolveServerEntry,
  spawnAppServer,
  stopChild,
  waitHealth,
} from './lib/server.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow = null
let tray = null
let trayOk = false
let isQuitting = false
let serverChild = null
let appRoot = ''
let port = 3780

function appOrigin() {
  return `http://127.0.0.1:${port}`
}

function resolveAppRoot() {
  const fromArg = process.argv.find((a, i) => i > 0 && a && !a.startsWith('-') && fs.existsSync(path.join(a, 'package.json')))
  if (fromArg) return path.resolve(fromArg)
  try {
    const fromElectron = app.getAppPath()
    if (fromElectron && fs.existsSync(path.join(fromElectron, 'package.json'))) {
      return fromElectron
    }
  } catch {
    /* app 尚未 ready */
  }
  return path.resolve(__dirname, '..')
}

function showMainWindow() {
  if (!mainWindow) return
  mainWindow.show()
  mainWindow.focus()
}

function createTray() {
  if (tray) return
  const iconPath = path.join(__dirname, 'icon.png')
  if (!fs.existsSync(iconPath)) return
  try {
    const image = nativeImage.createFromPath(iconPath)
    if (image.isEmpty()) return
    tray = new Tray(image)
    tray.setToolTip('oh-my-co-work')
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: '打开工作台', click: () => showMainWindow() },
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
      ]),
    )
    tray.on('double-click', () => showMainWindow())
    trayOk = true
  } catch {
    trayOk = false
  }
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'oh-my-co-work',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  await mainWindow.loadURL(appOrigin() + '/workbench')

  mainWindow.on('close', (evt) => {
    if (!isQuitting && trayOk) {
      evt.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function registerIpc() {
  ipcMain.handle('acw:notify', (_evt, payload) => {
    const title = String(payload?.title || '')
    const body = String(payload?.options?.body || '')
    if (!title) return false
    if (!Notification.isSupported()) return false
    const notification = new Notification({ title, body })
    notification.show()
    return true
  })

  ipcMain.handle('acw:apply-desktop-update', (_evt, manifest) => desktopUpdateResult(manifest))

  ipcMain.handle('acw:minimize-to-tray', () => {
    if (!mainWindow) return false
    if (!trayOk) return false
    mainWindow.hide()
    return true
  })

  ipcMain.handle('acw:launch-workflow', (_evt, sessionIdOrGroupId) => {
    if (!mainWindow) return false
    showMainWindow()
    const target = workbenchUrl(appOrigin(), sessionIdOrGroupId)
    mainWindow.loadURL(target).catch(() => {})
    return true
  })
}

async function ensureServer() {
  port = Number(process.env.ACW_PORT || 3780)
  if (await isServerUp(port)) return
  const nodeBin = resolveNodeBin(appRoot)
  const entry = resolveServerEntry(appRoot)
  fs.mkdirSync(path.join(appRoot, 'data'), { recursive: true })
  const logPath = path.join(appRoot, 'data', 'desktop-server.log')
  const logStream = fs.createWriteStream(logPath, { flags: 'a' })
  serverChild = spawnAppServer({
    appRoot,
    port,
    nodeBin,
    entry,
    logStream,
  })
  serverChild.on('exit', (code) => {
    if (!isQuitting && code) {
      dialog.showErrorBox('oh-my-co-work', `后台服务已退出（${code}）。可查看 data/desktop-server.log`)
    }
  })
  await waitHealth(port)
}

registerIpc()

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => showMainWindow())

  app.whenReady().then(async () => {
    appRoot = resolveAppRoot()
    process.chdir(appRoot)
    try {
      await ensureServer()
      createTray()
      await createMainWindow()
    } catch (e) {
      dialog.showErrorBox('oh-my-co-work 启动失败', String(e?.message || e))
      isQuitting = true
      app.quit()
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
      } else {
        showMainWindow()
      }
    })
  })
}

app.on('before-quit', () => {
  isQuitting = true
  stopChild(serverChild)
  serverChild = null
})

app.on('window-all-closed', () => {
  if (trayOk && !isQuitting) return
  app.quit()
})
