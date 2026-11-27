/**
 * Recapture README screenshots (1440×900 @2x) → docs/assets/screenshots/*.webp
 * Prerequisites: server on ACW_CAPTURE_BASE (default http://127.0.0.1:3780 with web/dist, or the Vite app on :5173), seeded demo.
 * ACW_CAPTURE_DARK_ONLY=1 writes only the *-dark.webp shots and restores the previous color scheme.
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
  console.warn('webp convert skipped', png, cwebp.stderr || magick.stderr)
  return png
}

async function snap(page, name) {
  const png = path.join(outDir, `${name}.png`)
  const webp = path.join(outDir, `${name}.webp`)
  await page.screenshot({ path: png, fullPage: false })
  return toWebp(png, webp)
}

const darkOnly = process.env.ACW_CAPTURE_DARK_ONLY === '1'

async function setColorScheme(page, scheme) {
  await page.evaluate(async (scheme) => {
    const boot = await fetch('/api/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }).then((r) => r.json())
    const res = await fetch('/api/settings/app', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-ACW-Token': boot.token },
      body: JSON.stringify({ ui: { colorScheme: scheme } }),
    })
    if (!res.ok) throw new Error(await res.text())
    localStorage.setItem('acw.uiColorScheme', scheme)
  }, scheme)
}

async function dismissToasts(page) {
  const closes = page.locator('.el-message__closeBtn')
  const n = await closes.count()
  for (let i = 0; i < n; i += 1) {
    await closes.nth(i).click().catch(() => {})
  }
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
})

async function ready(url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.waitForTimeout(600)
}

async function dismissOnboarding() {
  const tour = page.getByRole('button', { name: /开始探索|知道了|关闭/ }).first()
  if (await tour.isVisible().catch(() => false)) {
    await tour.click().catch(() => {})
    await page.waitForTimeout(400)
  }
}

async function openDemoSession() {
  await ready(`${baseUrl}/workbench`)
  await dismissOnboarding()
  const conv = page.locator('.conv-row').first()
  if (await conv.count()) {
    await conv.click()
    await page.waitForSelector('.wb-chat-header', { timeout: 30_000 })
    return
  }
  const demo = page.getByRole('button', { name: /演示|体验|开聊/ }).first()
  if (await demo.count()) {
    await demo.click()
    await page.waitForTimeout(2000)
    await page.waitForSelector('.wb-chat-header', { timeout: 60_000 })
  }
}

const saved = {}

if (!darkOnly) {
await ready(`${baseUrl}/workbench`)
await dismissOnboarding()
saved['workbench-home'] = await snap(page, 'workbench-home')

await openDemoSession()
saved['workbench-overview'] = await snap(page, 'workbench-overview')

const flowTab = page.getByRole('tab', { name: /流程/ }).first()
if (await flowTab.isVisible().catch(() => false)) await flowTab.click()
saved['chat-terminal-collaboration'] = await snap(page, 'chat-terminal-collaboration')

await ready(`${baseUrl}/settings/members`)
await dismissOnboarding()
const editBtn = page.getByRole('button', { name: /编辑/ }).first()
if (await editBtn.isVisible().catch(() => false)) {
  await editBtn.click()
  await page.waitForTimeout(800)
}
saved['terminal-member-settings'] = await snap(page, 'terminal-member-settings')

await openDemoSession()
const termBtn = page.getByRole('button', { name: /进入终端|查看终端/ }).first()
if (await termBtn.isVisible().catch(() => false)) {
  await termBtn.click()
  await page.waitForSelector('.terminal-workspace, .terminal-view', { timeout: 20_000 })
  const fullBtn = page.getByRole('button', { name: /满屏/ }).first()
  if (await fullBtn.isVisible().catch(() => false)) await fullBtn.click()
  await page.waitForTimeout(500)
}
saved['embedded-tui-fullscreen'] = await snap(page, 'embedded-tui-fullscreen')

await openDemoSession()
const petOpen = page.getByRole('button', { name: /开熔炉/ }).first()
if (await petOpen.isVisible().catch(() => false)) {
  await petOpen.click()
  await page.waitForTimeout(1200)
}
const guide = page.locator('.grok-guide-dialog, .el-overlay-dialog')
if (await guide.isVisible().catch(() => false)) {
  saved['furnace-grok-guide'] = await snap(page, 'furnace-grok-guide')
  const close = page.getByRole('button', { name: /关闭|以后再说/ }).first()
  if (await close.isVisible().catch(() => false)) await close.click()
} else {
  saved['furnace-grok-guide'] = await snap(page, 'furnace-grok-guide')
}

await ready(`${baseUrl}/workbench?furnace=1`)
await dismissOnboarding()
await page.waitForSelector('.furnace-workspace, .furnace-welcome', { timeout: 25_000 }).catch(() => {})
await page.waitForTimeout(800)
saved['furnace-workspace-chat'] = await snap(page, 'furnace-workspace-chat')

await ready(`${baseUrl}/docs`)
await page.waitForSelector('.docs-hub, .dh-body', { timeout: 30_000 })
const groupRow = page.locator('.dh-tree-row--branch').first()
if (await groupRow.count()) {
  await groupRow.click()
  await page.waitForTimeout(300)
}
const fileRow = page.locator('.dh-tree-row--leaf').first()
if (await fileRow.count()) await fileRow.click()
await page.waitForTimeout(600)
saved['docs-hub'] = await snap(page, 'docs-hub')

await openDemoSession()
saved['docs-hub-rail'] = await snap(page, 'docs-hub-rail')

await openDemoSession()
const deskPng = path.join(outDir, 'windows-desktop.png')
await page.screenshot({ path: deskPng, fullPage: false })
saved['windows-desktop'] = deskPng
}

await ready(`${baseUrl}/workbench`)
await dismissOnboarding()
const previousScheme = await page.evaluate(async () => {
  const boot = await fetch('/api/bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }).then((r) => r.json())
  const res = await fetch('/api/settings/app', {
    headers: { 'X-ACW-Token': boot.token },
  })
  const data = await res.json()
  return data?.ui?.colorScheme || 'system'
})
await setColorScheme(page, 'dark')
await ready(`${baseUrl}/workbench`)
await dismissOnboarding()
await dismissToasts(page)
await page.waitForFunction(() => document.documentElement.classList.contains('ecw-theme-dark'))
saved['workbench-home-dark'] = await snap(page, 'workbench-home-dark')

await openDemoSession()
await dismissToasts(page)
saved['workbench-overview-dark'] = await snap(page, 'workbench-overview-dark')

await ready(`${baseUrl}/docs`)
await page.waitForSelector('.docs-hub, .dh-body', { timeout: 30_000 })
await dismissToasts(page)
saved['docs-hub-dark'] = await snap(page, 'docs-hub-dark')

await setColorScheme(page, previousScheme)

await browser.close()
console.log(JSON.stringify(saved, null, 2))