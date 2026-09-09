/**
 * Capture README screenshots for the docs hub (standalone /docs + workbench rail).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'docs/assets/screenshots')
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

await ready('http://127.0.0.1:5173/docs')
await page.waitForSelector('.docs-hub, .dh-body, .docs-brand-title', { timeout: 30_000 })
// 点开群报告
const announce = page.locator('text=群报告').first()
if (await announce.count()) {
  await announce.click()
  await page.waitForTimeout(600)
}
const hubPng = path.join(outDir, 'docs-hub.png')
await page.screenshot({ path: hubPng, fullPage: false })

await ready('http://127.0.0.1:5173/')
await page.waitForSelector('.workbench, .wb-center', { timeout: 30_000 })
await page.waitForTimeout(1200)
const conv = page.locator('.conv-row, .wb-conversations [class*="item"]').first()
await conv.waitFor({ timeout: 15_000 })
await conv.click()
await page.waitForTimeout(900)
const docsTab = page.getByRole('button', { name: '文档中心' })
await docsTab.click()
await page.waitForSelector('.docs-rail-title, .docs-rail-files, .docs-pane', { timeout: 15_000 })
await page.waitForTimeout(800)
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
