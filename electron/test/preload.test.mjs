import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const electronDir = path.resolve(dir, '..')

// DESK-01: sandboxed preloads can't be ESM; the preload must be CommonJS.
test('preload.cjs exists and is CommonJS (not ESM)', () => {
  const cjs = path.join(electronDir, 'preload.cjs')
  assert.ok(fs.existsSync(cjs), 'electron/preload.cjs should exist')
  const src = fs.readFileSync(cjs, 'utf8')
  assert.match(src, /require\(['"]electron['"]\)/)
  assert.doesNotMatch(src, /^\s*import\s/m)
  assert.doesNotMatch(src, /^\s*export\s/m)
})

test('the ESM preload.js is gone and main.js points at preload.cjs', () => {
  assert.equal(fs.existsSync(path.join(electronDir, 'preload.js')), false)
  const main = fs.readFileSync(path.join(electronDir, 'main.js'), 'utf8')
  assert.match(main, /preload\.cjs/)
  assert.doesNotMatch(main, /preload\.js/)
})

test('preload exposes the desktop env flag and API keys', () => {
  const src = fs.readFileSync(path.join(electronDir, 'preload.cjs'), 'utf8')
  assert.ok(src.includes('__ACW_DESKTOP_ENV__'))
  assert.ok(src.includes('__ACW_DESKTOP_API__'))
  for (const key of [
    'notify',
    'minimizeToTray',
    'launchWorkflow',
    'getZoom',
    'setZoom',
    'onZoomMenu',
    'applyDesktopUpdate',
  ]) {
    assert.ok(src.includes(key), `preload is missing ${key}`)
  }
})
