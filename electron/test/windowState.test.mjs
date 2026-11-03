import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clampWindowBounds,
  applyStoredWindowBounds,
} from '../lib/windowState.mjs'

test('clampWindowBounds keeps window inside work area', () => {
  const out = clampWindowBounds(
    { x: -200, y: 50, width: 800, height: 500 },
    { x: 0, y: 0, width: 1280, height: 800 },
  )
  assert.equal(out.x, 0)
  assert.ok(out.width >= 800)
})

test('applyStoredWindowBounds uses setBounds', () => {
  const calls = []
  const win = {
    isDestroyed: () => false,
    isMaximized: () => false,
    isFullScreen: () => false,
    setBounds: (b) => calls.push(['bounds', b]),
    setFullScreen: (v) => calls.push(['fs', v]),
    maximize: () => calls.push(['max']),
  }
  const ok = applyStoredWindowBounds(
    win,
    { x: 10, y: 20, width: 1200, height: 700 },
    { x: 0, y: 0, width: 1920, height: 1080 },
  )
  assert.equal(ok, true)
  assert.equal(calls[0][0], 'bounds')
})

test('上次退出时处于全屏，重启只恢复最大化，不再盖住任务栏', () => {
  const calls = []
  const win = {
    setBounds: (b) => calls.push(['bounds', b]),
    setFullScreen: (v) => calls.push(['fs', v]),
    maximize: () => calls.push(['max']),
  }
  applyStoredWindowBounds(
    win,
    { x: 0, y: 0, width: 1920, height: 1080, isMaximized: true, isFullScreen: true },
    { x: 0, y: 0, width: 1920, height: 1040 },
  )
  assert.deepEqual(calls, [['max']])
})
