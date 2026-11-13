/**
 * Capture README screenshots for the docs hub + workbench docs entry.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'docs/assets/screenshots')
const baseUrl = process.env.ACW_CAPTURE_BASE || 'http://127.0.0.1:3780'
fs.mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
})

async function ready(url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
  await page.waitForTimeout(800)
}

await ready(`${baseUrl}/docs`)
await page.waitForSelector('.docs-hub, .dh-body, .docs-brand-title', { timeout: 30_000 })
const groupRow = page.locator('.dh-tree-row--branch').first()
if (await groupRow.count()) {
  await groupRow.click()
  await page.waitForTimeout(300)
}
const fileRow = page.locator('.dh-tree-row--leaf').first()
if (await fileRow.count()) {
  await fileRow.click()
  await page.waitForTimeout(600)
}
const hubPng = path.join(outDir, 'docs-hub.png')
await page.screenshot({ path: hubPng, fullPage: false })

await ready(`${baseUrl}/workbench`)
await page.waitForSelector('.workbench, .wb-center', { timeout: 30_000 })
const conv = page.locator('.conv-row').first()
if (await conv.count()) {
  await conv.click()
} else {
  const demo = page.getByRole('button', { name: /演示|体验/ }).first()
  if (await demo.count()) {
    await demo.click()
    await page.waitForTimeout(1500)
  }
}
await page.waitForSelector('.wb-chat-header', { timeout: 30_000 })
await page.waitForTimeout(600)
const railPng = path.join(outDir, 'docs-hub-rail.png')
await page.screenshot({ path: railPng, fullPage: false })

await browser.close()

function toWebp(png, webp) {
  const cwebp = spawnSync('cwebp', ['-q', '82', png, '-o', webp], { encoding: 'utf8' })
  if (cwebp.status === 0) {
    fs.rmSync(png, { force: true })
    return webp
  }
  const magick = spawnSync('magick', [png, '-quality', '82', webp], { encoding: 'utf8' })
  if (magick.status === 0) {
    fs.rmSync(png, { force: true })
    return webp
  }
  console.warn('webp convert skipped', cwebp.stderr || magick.stderr)
  return png
}

const hub = toWebp(hubPng, path.join(outDir, 'docs-hub.webp'))
const rail = toWebp(railPng, path.join(outDir, 'docs-hub-rail.webp'))
console.log(JSON.stringify({ hub, rail }, null, 2))
