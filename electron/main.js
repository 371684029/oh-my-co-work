import {
  app,
  BrowserWindow,
  Notification,
  Tray,
  Menu,
  ipcMain,
  dialog,
  nativeImage,
  shell,
  clipboard,
} from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { desktopUpdateResult, workbenchUrl } from './lib/urls.mjs'
import { splashDataUrl } from './lib/splash.mjs'
import { applyDesktopOpenState } from './lib/windowState.mjs'
import {
  isServerUp,
  resolveNodeBin,
  resolveServerEntry,
  readAppVersion,
  fetchHealth,
  spawnAppServer,
  openAppendFd,
  stopChild,
  waitHealth,
} from './lib/server.mjs'
import { createNotifier, parseSessionDeepLink } from './lib/notifier.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow = null
let notifier = null
let tray = null
let trayOk = false
let isQuitting = false
let serverChild = null
let appRoot = ''
let port = 3780

// DESK-03: persisted desktop preferences (close-to-tray behavior + one-time hint).
const DEFAULT_DESKTOP_PREFS = { closeToTray: true, trayHintShown: false }
let desktopPrefs = { ...DEFAULT_DESKTOP_PREFS }

function prefsPath() {
  const root = appRoot || resolveAppRoot()
  return path.join(root, 'data', 'desktop-prefs.json')
}

function loadDesktopPrefs() {
  try {
    const parsed = JSON.parse(fs.readFileSync(prefsPath(), 'utf8'))
    desktopPrefs = { ...DEFAULT_DESKTOP_PREFS, ...parsed }
  } catch {
    desktopPrefs = { ...DEFAULT_DESKTOP_PREFS }
  }
  return desktopPrefs
}

function saveDesktopPrefs() {
  try {
    fs.mkdirSync(path.dirname(prefsPath()), { recursive: true })
    fs.writeFileSync(prefsPath(), JSON.stringify(desktopPrefs, null, 2))
  } catch {
    /* ignore */
  }
}

function showTrayHintOnce() {
  if (desktopPrefs.trayHintShown) return
  desktopPrefs.trayHintShown = true
  saveDesktopPrefs()
  try {
    if (Notification.isSupported()) {
      new Notification({
        title: 'oh-my-co-work',
        body: '已最小化到托盘，退出请用托盘菜单 → 退出。',
      }).show()
    }
  } catch {
    /* ignore */
  }
}

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

function appendLog(message) {
  try {
    const root = appRoot || resolveAppRoot()
    fs.mkdirSync(path.join(root, 'data'), { recursive: true })
    fs.appendFileSync(path.join(root, 'data', 'electron.log'), `[${new Date().toISOString()}] ${message}\n`)
  } catch {
    /* ignore */
  }
}

function showMainWindow() {
  if (!mainWindow) return
  mainWindow.show()
  mainWindow.focus()
}

function ensureNotifier() {
  if (!notifier) {
    notifier = createNotifier({
      getMainWindow: () => mainWindow,
      Notification,
      onDeepLink(deepLink) {
        const sessionId = parseSessionDeepLink(deepLink)
        if (!sessionId || !mainWindow) return
        mainWindow.loadURL(workbenchUrl(appOrigin(), sessionId)).catch(() => {})
      },
    })
  }
  return notifier
}

function appIconPath() {
  const ico = path.join(__dirname, 'icon.ico')
  const png = path.join(__dirname, 'icon.png')
  if (process.platform === 'win32' && fs.existsSync(ico)) return ico
  return png
}

function createTray() {
  if (tray) return
  const iconPath = appIconPath()
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
        {
          label: '关闭窗口时退出',
          type: 'checkbox',
          checked: !desktopPrefs.closeToTray,
          click: (menuItem) => {
            desktopPrefs.closeToTray = !menuItem.checked
            saveDesktopPrefs()
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
    icon: appIconPath(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  await mainWindow.loadURL(splashDataUrl())
  applyDesktopOpenState(mainWindow)
  mainWindow.show()

  mainWindow.on('close', (evt) => {
    if (isQuitting) return
    // DESK-03: when close-to-tray is on, hide instead of quitting and explain it
    // once so users don't mistake it for a real exit. Otherwise let the close
    // proceed; window-all-closed then quits (see below).
    if (desktopPrefs.closeToTray && trayOk) {
      evt.preventDefault()
      mainWindow.hide()
      showTrayHintOnce()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url)
      const local = new URL(appOrigin())
      if (target.origin === local.origin) {
        return { action: 'allow' }
      }
      if (target.protocol === 'http:' || target.protocol === 'https:') {
        shell.openExternal(url).catch(() => {})
        return { action: 'deny' }
      }
    } catch {
      /* ignore malformed url */
    }
    return { action: 'deny' }
  })
}

async function loadWorkbench() {
  if (!mainWindow) return
  await mainWindow.loadURL(appOrigin() + '/workbench')
}

function registerIpc() {
  ipcMain.handle('acw:clipboard-read', () => clipboard.readText())
  ipcMain.handle('acw:clipboard-write', (_evt, text) => {
    clipboard.writeText(String(text ?? ''))
    return true
  })

  ipcMain.handle('acw:notify', (_evt, payload) => {
    const title = String(payload?.title || '')
    const body = String(payload?.options?.body || '')
    const id = payload?.options?.id
    const deepLink = payload?.options?.deepLink
    return ensureNotifier().notify({ id, title, body, deepLink })
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

async function pickFreePort(startPort, span = 10) {
  for (let p = startPort; p < startPort + span; p++) {
    if (!(await isServerUp(p))) return p
  }
  return null
}

async function ensureServer() {
  port = Number(process.env.ACW_PORT || 3780)
  const desiredVersion = readAppVersion(appRoot)
  if (await isServerUp(port)) {
    // DESK-02: don't blindly reuse whatever answers on the port. A differently
    // versioned process there is a foreign/stale server — load our own on the
    // next free port instead of showing the wrong backend.
    const health = await fetchHealth(port).catch(() => null)
    if (desiredVersion && health?.version && health.version !== desiredVersion) {
      appendLog(
        `port ${port} held by foreign server v${health.version} (want v${desiredVersion}); picking alternate port`,
      )
      const alt = await pickFreePort(port + 1)
      if (!alt) {
        throw new Error(
          `端口 ${port} 被其它版本的后台服务占用（v${health.version}），备用端口也不可用。请先关闭该服务再重试。`,
        )
      }
      port = alt
    } else {
      appendLog(`reusing server on ${port} (v${health?.version || '?'}, id=${health?.instanceId || 'unknown'})`)
      return
    }
  }

  const nodeBin = resolveNodeBin(appRoot)
  const entry = resolveServerEntry(appRoot)
  fs.mkdirSync(path.join(appRoot, 'data'), { recursive: true })
  const logPath = path.join(appRoot, 'data', 'desktop-server.log')
  const logFd = openAppendFd(logPath)
  const instanceId = randomUUID()
  serverChild = spawnAppServer({
    appRoot,
    port,
    nodeBin,
    entry,
    logFd,
    instanceId,
  })
  try {
    fs.closeSync(logFd)
  } catch {
    /* 子进程已复制 fd */
  }
  serverChild.on('error', (err) => {
    if (!isQuitting) {
      dialog.showErrorBox('oh-my-co-work', `无法启动后台服务：${err?.message || err}`)
    }
  })
  serverChild.on('exit', (code) => {
    if (!isQuitting && code) {
      dialog.showErrorBox('oh-my-co-work', `后台服务已退出（${code}）。可查看 data/desktop-server.log`)
    }
  })
  await waitHealth(port)
  // Best-effort identity check: confirm the server we just waited on is ours.
  const health = await fetchHealth(port).catch(() => null)
  if (health?.instanceId && health.instanceId !== instanceId) {
    appendLog(`warning: /api/health instanceId ${health.instanceId} != expected ${instanceId}`)
  }
}

registerIpc()

appRoot = resolveAppRoot()
loadDesktopPrefs()
try {
  const userData = path.join(appRoot, 'data', 'electron-profile')
  fs.mkdirSync(userData, { recursive: true })
  app.setPath('userData', userData)
} catch {
  /* ignore */
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  appendLog('second instance, quit')
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) {
      createMainWindow().catch((e) => appendLog(`second-instance createWindow ${e}`))
    } else {
      showMainWindow()
    }
  })

  app.whenReady().then(async () => {
    appRoot = resolveAppRoot()
    process.chdir(appRoot)
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.oh-my-co-work.desktop')
    }
    appendLog(`whenReady appRoot=${appRoot} port=${process.env.ACW_PORT || 3780}`)
    try {
      createTray()
      await createMainWindow()
      appendLog('splash window shown')
      await ensureServer()
      appendLog('server ready')
      await loadWorkbench()
      appendLog('workbench loaded')
    } catch (e) {
      appendLog(`startup failed ${e?.stack || e}`)
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
  if (trayOk && !isQuitting && desktopPrefs.closeToTray) return
  app.quit()
})
