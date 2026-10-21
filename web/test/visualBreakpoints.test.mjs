import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * TEST-06 structural guard: breakpoint tokens + three width targets documented in CSS.
 */
test('styles.css defines workbench breakpoints for visual regression baseline', () => {
  const css = fs.readFileSync(path.join(webRoot, 'src/styles.css'), 'utf8')
  assert.match(css, /--ecw-bp-compact:\s*1099px/)
  assert.match(css, /--ecw-bp-mid:\s*1439px/)
  assert.match(css, /@media \(max-width: 1099px\)/)
  assert.match(css, /@media \(max-width: 1439px\)/)
})
