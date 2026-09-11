import test from 'node:test'
import assert from 'node:assert/strict'
import { detectDesktopEnvironment, useDesktopBridge } from '../src/composables/useDesktopBridge.js'

test('detectDesktopEnvironment defaults to web when window is missing or standard', () => {
  assert.equal(detectDesktopEnvironment({}), 'web')
  assert.equal(detectDesktopEnvironment(null), 'web')
})

test('detectDesktopEnvironment detects __ACW_DESKTOP_ENV__ custom tag', () => {
  const mockWin = { __ACW_DESKTOP_ENV__: 'webview2' }
  assert.equal(detectDesktopEnvironment(mockWin), 'webview2')
})

test('detectDesktopEnvironment detects Tauri and Electron flags', () => {
  assert.equal(detectDesktopEnvironment({ __TAURI__: {} }), 'tauri')
  assert.equal(detectDesktopEnvironment({ electron: {} }), 'electron')
  assert.equal(detectDesktopEnvironment({ process: { versions: { electron: '25.0.0' } } }), 'electron')
})

test('useDesktopBridge handles fallback notify and minimizeToTray gracefully', async () => {
  const { initDesktopBridge, isDesktop, desktopEnv, notify, minimizeToTray } = useDesktopBridge()

  const env = initDesktopBridge({ __ACW_DESKTOP_ENV__: 'tauri' })
  assert.equal(env, 'tauri')
  assert.equal(isDesktop.value, true)
  assert.equal(desktopEnv.value, 'tauri')

  // test mock native desktop API invocation
  let notified = false
  const mockWin = {
    __ACW_DESKTOP_ENV__: 'tauri',
    __ACW_DESKTOP_API__: {
      notify: async (title) => {
        notified = true
        return title
      },
      minimizeToTray: async () => true,
    },
  }
  globalThis.window = mockWin

  initDesktopBridge(mockWin)
  const res = await notify('Test Notification')
  assert.equal(notified, true)
  assert.equal(res, 'Test Notification')

  const trayRes = await minimizeToTray()
  assert.equal(trayRes, true)

  delete globalThis.window
})

test('detectDesktopEnvironment correctly identifies electron when process.versions.electron is present', () => {
  const mockWin = {
    process: {
      versions: {
        electron: '30.0.0',
      },
    },
  }
  assert.equal(detectDesktopEnvironment(mockWin), 'electron')
})

test('build configuration for electron-builder is present in root package.json', async () => {
  const pkgModule = await import('../../package.json', { with: { type: 'json' } })
  const pkg = pkgModule.default
  assert.equal(pkg.main, 'electron/main.js')
  assert.equal(pkg.build.appId, 'com.ohmycowork.app')
  assert.ok(Array.isArray(pkg.build.mac.target))
})

test('useDesktopBridge handles launchWorkflow and applyDesktopUpdate extension methods', async () => {
  const { initDesktopBridge, launchWorkflow, applyDesktopUpdate } = useDesktopBridge()

  let launchedSession = ''
  let updateManifest = null

  const mockWin = {
    __ACW_DESKTOP_ENV__: 'electron',
    __ACW_DESKTOP_API__: {
      launchWorkflow: async (sid) => {
        launchedSession = sid
        return true
      },
      applyDesktopUpdate: async (manifest) => {
        updateManifest = manifest
        return true
      },
    },
  }

  globalThis.window = mockWin
  initDesktopBridge(mockWin)

  const wfRes = await launchWorkflow('session-123')
  assert.equal(wfRes, true)
  assert.equal(launchedSession, 'session-123')

  const updateRes = await applyDesktopUpdate({ version: '4.9.0' })
  assert.equal(updateRes, true)
  assert.deepEqual(updateManifest, { version: '4.9.0' })

  delete globalThis.window
})
