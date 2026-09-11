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
