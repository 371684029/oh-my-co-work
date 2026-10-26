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
  screen,
} from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { desktopUpdateResult, docsHubUrl, workbenchUrl } from './lib/urls.mjs'
import { splashDataUrl, setSplashStatus } from './lib/splash.mjs'
import { resolveDefaultAcwDataRoot } from './lib/dataDir.mjs'
import { consumeApplyOnQuit } from './lib/desktopUpdate.mjs'
import {
  applyDesktopOpenState,
  applyStoredWindowBounds,
  captureWindowBounds,
} from './lib/windowState.mjs'
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
import { releaseAllResources } from './lib/shutdown.mjs'
import { createNotifier, parseNotificationDeepLink } from './lib/notifier.mjs'
import {
  isNotificationsPaused,
  normalizeTrayStatus,
  formatTrayTooltip,
  formatTrayMenuHeader,
  formatPauseEnd,
  pauseForOneHour,
  pauseUntilTomorrow,
} from './lib/trayState.mjs'
import { buildCountBadgeBitmap } from './lib/overlayBadge.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow = null
/** @type {Map<string, import('electron').BrowserWindow>} */
const detachedWindows = new Map()
let notifier = null
let trayPendingCount = 0
/** NTF-07: 托盘状态（idle/running/needs-you/error）与待处理条目（最多 5 条） */
let trayStatus = 'idle'
let trayItems = []
let tray = null
let trayOk = false
let isQuitting = false
let serverChild = null
let appRoot = ''
let port = 3780

// DESK-03: persisted desktop preferences (close-to-tray behavior + one-time hint).
// NTF-07: notificationsPausedUntil 暂停通知截止时间（epoch ms，0 = 未暂停）。
const DEFAULT_DESKTOP_PREFS = {
  closeToTray: true,
  trayHintShown: false,
  mainWindowBounds: null,
  notificationsPausedUntil: 0,
}
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
        body: '已最小化到托盘，通知仍会送达；退出请用托盘菜单 → 退出。',
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

function sendZoomToRenderer(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('acw:zoom-menu', payload || {})
}

function setupApplicationMenu() {
  const zoomItem = (label, payload, accelerator) => ({
    label,
    accelerator,
    click: () => sendZoomToRenderer(payload),
  })
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { role: 'editMenu' },
    {
      label: '视图',
      submenu: [
        zoomItem('放大', { step: 1 }, 'CmdOrCtrl+='),
        zoomItem('缩小', { step: -1 }, 'CmdOrCtrl+-'),
        zoomItem('实际大小', { reset: true }, 'CmdOrCtrl+0'),
        { type: 'separator' },
        { role: 'togglefullscreen', label: '切换全屏' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function ensureNotifier() {
  if (!notifier) {
    notifier = createNotifier({
      getMainWindow: () => mainWindow,
      Notification,
      onDeepLink(deepLink) {
        navigateToDeepLink(deepLink)
      },
      onNotificationAction(payload) {
        if (!mainWindow || mainWindow.isDestroyed()) return
        mainWindow.webContents.send('acw:notification-action', payload || {})
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

function refreshTrayToolTip() {
  if (!tray) return
  try {
    tray.setToolTip(
      formatTrayTooltip({
        state: trayStatus,
        pending: trayPendingCount,
        pausedUntil: desktopPrefs.notificationsPausedUntil,
      }),
    )
  } catch {
    /* ignore */
  }
}

/** 深链：显示主窗口并路由到会话/文档（托盘菜单与通知点击共用）。 */
function navigateToDeepLink(deepLink) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const parsed = parseNotificationDeepLink(deepLink)
  if (!parsed) return
  const url =
    parsed.type === 'docs'
      ? docsHubUrl(appOrigin(), parsed.sessionId, parsed.file)
      : workbenchUrl(appOrigin(), parsed.sessionId)
  mainWindow.loadURL(url).catch(() => {})
}

function openDeepLink(deepLink) {
  showMainWindow()
  navigateToDeepLink(deepLink)
}

function truncateMenuLabel(text, max = 40) {
  const s = String(text || '').trim()
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

function pauseNotifications(until) {
  desktopPrefs.notificationsPausedUntil = Number(until) || 0
  saveDesktopPrefs()
  refreshTrayToolTip()
  refreshTrayMenu()
}

function resumeNotifications() {
  pauseNotifications(0)
}

function buildTrayMenuTemplate() {
  const pausedUntil = Number(desktopPrefs.notificationsPausedUntil) || 0
  const paused = isNotificationsPaused(pausedUntil)
  const pending = trayItems.slice(0, 5)
  return [
    // 状态分区：Electron MenuItem 无原生加粗，用标记字符 + 禁用项做视觉强调
    {
      label: formatTrayMenuHeader({
        state: trayStatus,
        pending: trayPendingCount,
        pausedUntil,
      }),
      enabled: false,
    },
    {
      label: '待处理（最多 5 条）',
      submenu: pending.length
        ? pending.map((it) => ({
            label: truncateMenuLabel(it.title || it.id || '待处理项'),
            click: () => openDeepLink(it.deepLink),
          }))
        : [{ label: '暂无待处理项', enabled: false }],
    },
    { type: 'separator' },
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
    ...(paused
      ? [
          {
            label: `恢复通知（已暂停至 ${formatPauseEnd(pausedUntil)}）`,
            click: () => resumeNotifications(),
          },
        ]
      : [
          {
            label: '暂停通知 1 小时',
            click: () => pauseNotifications(pauseForOneHour()),
          },
          {
            label: '暂停通知到明天',
            click: () => pauseNotifications(pauseUntilTomorrow()),
          },
        ]),
    { type: 'separator' },
    {
      label: '退出',
      click: async () => {
        if (trayPendingCount > 0) {
          const { response } = await dialog.showMessageBox({
            type: 'warning',
            title: '仍有待处理事项',
            message: `当前有 ${trayPendingCount} 项待处理通知/闸门，确定要退出吗？`,
            buttons: ['取消', '仍要退出'],
            defaultId: 0,
            cancelId: 0,
          })
          if (response !== 1) return
        }
        isQuitting = true
        app.quit()
      },
    },
  ]
}

function refreshTrayMenu() {
  if (!tray) return
  try {
    tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenuTemplate()))
  } catch {
    /* ignore */
  }
}

/**
 * NTF-08：任务栏/Dock 角标。win32 用运行时生成的数字角标图（无 .ico 资产，
 * 失败回退 icon.ico）；macOS 保留 Dock badge。Linux 不做角标（仅 tooltip/菜单）。
 */
function buildOverlayIcon(count) {
  try {
    const { buffer, width, height } = buildCountBadgeBitmap(count)
    const img = nativeImage.createFromBitmap(buffer, { width, height })
    if (img && !img.isEmpty()) return img
  } catch {
    /* fall back to the app icon below */
  }
  return nativeImage.createFromPath(appIconPath())
}

function applyDesktopBadges() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const pending = Math.min(99, Math.max(0, trayPendingCount))
  if (process.platform === 'darwin' && app.dock?.setBadge) {
    try {
      app.dock.setBadge(pending > 0 ? String(pending) : '')
    } catch {
      /* ignore */
    }
    return
  }
  if (process.platform === 'win32') {
    try {
      if (pending > 0 && typeof mainWindow.setOverlayIcon === 'function') {
        mainWindow.setOverlayIcon(buildOverlayIcon(pending), `${pending} 项待处理`)
      } else if (typeof mainWindow.setOverlayIcon === 'function') {
        mainWindow.setOverlayIcon(null, '')
      }
    } catch {
      /* ignore */
    }
  }
}

/** NTF-08：流程进度条；仅在 IPC 提供 progress 时驱动（null 清除）。 */
function applyFlowProgress(progress) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  try {
    if (progress === null) {
      mainWindow.setProgressBar(-1)
      return
    }
    const v = Number(progress)
    if (!Number.isFinite(v)) return
    mainWindow.setProgressBar(Math.min(1, Math.max(0, v)))
  } catch {
    /* ignore */
  }
}

function createTray() {
  if (tray) return
  // NTF-07 限制：仅有一套图标资产（icon.png / icon.ico），无状态位图；状态通过
  // tooltip + 菜单状态行区分，未生成额外二进制图标。
  const iconPath = appIconPath()
  if (!fs.existsSync(iconPath)) return
  try {
    const image = nativeImage.createFromPath(iconPath)
    if (image.isEmpty()) return
    tray = new Tray(image)
    refreshTrayToolTip()
    refreshTrayMenu()
    tray.on('double-click', () => showMainWindow())
    trayOk = true
  } catch {
    trayOk = false
  }
}

function browserWindowOptions() {
  return {
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
  }
}

function workAreaForWindow(win) {
  try {
    const display = screen.getDisplayMatching(win.getBounds())
    return display?.workArea || { x: 0, y: 0, width: 1280, height: 800 }
  } catch {
    return { x: 0, y: 0, width: 1280, height: 800 }
  }
}

function persistMainWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  desktopPrefs.mainWindowBounds = captureWindowBounds(mainWindow)
  saveDesktopPrefs()
}

function wireWindowNavigation(win) {
  win.webContents.on('will-navigate', (evt, url) => {
    try {
      const target = new URL(url)
      const local = new URL(appOrigin())
      if (target.origin !== local.origin) {
        evt.preventDefault()
        shell.openExternal(url).catch(() => {})
      }
    } catch {
      evt.preventDefault()
    }
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
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

async function createDetachedWindow(relativePath) {
  const rel = String(relativePath || '/workbench').startsWith('/')
    ? String(relativePath || '/workbench')
    : `/${relativePath}`
  const id = randomUUID()
  const win = new BrowserWindow({
    ...browserWindowOptions(),
    width: 1100,
    height: 720,
  })
  wireWindowNavigation(win)
  detachedWindows.set(id, win)
  win.on('closed', () => detachedWindows.delete(id))
  await win.loadURL(`${appOrigin()}${rel}`)
  win.show()
  return id
}

async function createMainWindow() {
  const stored = desktopPrefs.mainWindowBounds
  mainWindow = new BrowserWindow({
    width: stored?.width || 1280,
    height: stored?.height || 800,
    x: stored?.x,
    y: stored?.y,
    ...browserWindowOptions(),
  })

  await mainWindow.loadURL(splashDataUrl())
  const workArea = workAreaForWindow(mainWindow)
  const restored = applyStoredWindowBounds(mainWindow, stored, workArea)
  if (!restored) applyDesktopOpenState(mainWindow)
  mainWindow.show()

  let boundsTimer = 0
  const scheduleBoundsSave = () => {
    clearTimeout(boundsTimer)
    boundsTimer = setTimeout(persistMainWindowBounds, 400)
  }
  mainWindow.on('resize', scheduleBoundsSave)
  mainWindow.on('move', scheduleBoundsSave)
  mainWindow.on('maximize', scheduleBoundsSave)
  mainWindow.on('unmaximize', scheduleBoundsSave)
  mainWindow.on('enter-full-screen', scheduleBoundsSave)
  mainWindow.on('leave-full-screen', scheduleBoundsSave)

  wireWindowNavigation(mainWindow)

  mainWindow.on('close', (evt) => {
    persistMainWindowBounds()
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

}

async function loadWorkbench() {
  if (!mainWindow) return
  await mainWindow.loadURL(appOrigin() + '/workbench')
}

function registerIpc() {
  ipcMain.handle('acw:tray-status', (_evt, payload) => {
    const p = payload && typeof payload === 'object' ? payload : {}
    if (p.pending !== undefined) {
      trayPendingCount = Math.max(0, Number(p.pending) || 0)
    }
    if (p.status !== undefined) {
      trayStatus = normalizeTrayStatus(p.status)
    }
    if (Array.isArray(p.items)) {
      trayItems = p.items
        .slice(0, 5)
        .map((it) => ({
          id: String(it?.id || ''),
          title: String(it?.title || '').slice(0, 80),
          deepLink: String(it?.deepLink || ''),
        }))
        .filter((it) => it.title || it.deepLink)
    }
    if (p.progress !== undefined) applyFlowProgress(p.progress)
    refreshTrayToolTip()
    refreshTrayMenu()
    applyDesktopBadges()
    return true
  })

  ipcMain.handle('acw:clipboard-read', () => clipboard.readText())
  ipcMain.handle('acw:clipboard-write', (_evt, text) => {
    clipboard.writeText(String(text ?? ''))
    return true
  })

  ipcMain.handle('acw:notification-platform', () => {
    const supported = Notification.isSupported()
    const platform = process.platform
    let hint = ''
    let docPath = ''
    if (platform === 'darwin') {
      hint =
        'macOS：在「系统设置 → 通知」中允许本应用；未签名/未公证包的通知行为可能受限。'
      docPath = 'docs/NOTIFICATION-MANUAL-QA.md#macos-intel-或-apple-silicon'
    } else if (platform === 'linux') {
      hint = supported
        ? 'Linux：通知依赖 libnotify 与 DBus（GNOME/KDE 通常已具备）。'
        : 'Linux：未检测到可用通知通道。请安装 libnotify 并确保 DBus 会话运行（可试 notify-send）。'
      docPath = 'docs/NOTIFICATION-MANUAL-QA.md#linux-gnome--kde'
    } else if (platform === 'win32') {
      hint = 'Windows：若未弹出通知，请检查系统通知权限与专注助手；开发态需 AppUserModelID。'
      docPath = 'docs/NOTIFICATION-MANUAL-QA.md#windows-10--11'
    }
    return { supported, platform, hint, docPath }
  })

  ipcMain.handle('acw:notify', (_evt, payload) => {
    const title = String(payload?.title || '')
    const body = String(payload?.options?.body || '')
    const id = payload?.options?.id
    const deepLink = payload?.options?.deepLink
    const level = payload?.options?.level
    const sound = payload?.options?.sound
    // NTF-07：暂停通知期间抑制非 action 级别（需要你的闸门仍会送达）
    if (
      isNotificationsPaused(desktopPrefs.notificationsPausedUntil) &&
      String(level || 'action') !== 'action'
    ) {
      return false
    }
    const shown = ensureNotifier().notify({ id, title, body, deepLink, level, sound })
    if (shown && mainWindow && !mainWindow.isDestroyed()) {
      if (!mainWindow.isFocused() || !mainWindow.isVisible()) {
        mainWindow.flashFrame(true)
        setTimeout(() => {
          try {
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.flashFrame(false)
          } catch {
            /* ignore */
          }
        }, 4500)
      }
      applyDesktopBadges()
    }
    return shown
  })

  ipcMain.handle('acw:apply-desktop-update', (_evt, manifest) =>
    desktopUpdateResult(manifest || {}, {
      userDataRoot: resolveDefaultAcwDataRoot(),
      appRoot,
    }),
  )

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

  ipcMain.handle('acw:open-detached-window', async (_evt, payload) => {
    const rel = String(payload?.path || payload?.url || '/workbench')
    try {
      return await createDetachedWindow(rel)
    } catch (e) {
      appendLog(`open-detached-window failed ${e?.message || e}`)
      return null
    }
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
  const dataRoot = resolveDefaultAcwDataRoot()
  try {
    fs.mkdirSync(dataRoot, { recursive: true })
  } catch {
    /* ignore */
  }
  serverChild = spawnAppServer({
    appRoot,
    port,
    nodeBin,
    entry,
    logFd,
    instanceId,
    dataRoot,
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
      setupApplicationMenu()
      createTray()
      await createMainWindow()
      appendLog('splash window shown')
      await setSplashStatus(mainWindow?.webContents, '正在启动本机服务…')
      await ensureServer()
      appendLog('server ready')
      await setSplashStatus(mainWindow?.webContents, '正在加载工作台…')
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

let quitReleaseDone = false
app.on('before-quit', (event) => {
  if (quitReleaseDone) return
  event.preventDefault()
  quitReleaseDone = true
  isQuitting = true
  const port = Number(process.env.ACW_PORT || 3780)
  void releaseAllResources(port).finally(() => {
    try {
      consumeApplyOnQuit(resolveDefaultAcwDataRoot(), appRoot)
    } catch {
      /* ignore */
    }
    stopChild(serverChild)
    serverChild = null
    app.exit(0)
  })
})

app.on('window-all-closed', () => {
  if (trayOk && !isQuitting && desktopPrefs.closeToTray) return
  app.quit()
})
