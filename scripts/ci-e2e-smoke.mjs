/**
 * CI：启动真实 server + 已构建 web/dist，Playwright 检查首页无障碍 skip-link。
 * 前置：npm run build -w web
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const webIndex = path.join(root, 'web/dist/index.html')
if (!fs.existsSync(webIndex)) {
  console.error('[ci-e2e-smoke] missing web/dist — run npm run build -w web first')
  process.exit(1)
}

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-e2e-'))
const port = 3870 + Math.floor(Math.random() * 80)

const child = spawn(process.execPath, ['server/src/index.js'], {
  cwd: root,
  env: {
    ...process.env,
    ACW_DATA_ROOT: dataRoot,
    ACW_PORT: String(port),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let bootLog = ''
child.stderr.on('data', (chunk) => {
  bootLog += chunk
})
child.stdout.on('data', (chunk) => {
  bootLog += chunk
})

async function waitHealth(maxMs = 45000) {
  const base = `http://127.0.0.1:${port}`
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${base}/api/health`)
      if (res.ok) return base
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`[ci-e2e-smoke] /api/health timeout after ${maxMs}ms\n${bootLog}`)
}

function shutdownChild() {
  if (child.killed) return
  child.kill('SIGTERM')
}

async function main() {
  let browser
  try {
    const base = await waitHealth()
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    await page.goto(base, { waitUntil: 'load', timeout: 60000 })
    const skip = page.locator('a.skip-link')
    assert.equal(await skip.count(), 1)
    const text = (await skip.textContent()) || ''
    assert.match(text, /主内容/)
    const main = page.locator('#main-content')
    assert.equal(await main.count(), 1)
    const health = await fetch(`${base}/api/health`)
    assert.equal(health.status, 200)
    const h = await health.json()
    assert.equal(h.ok, true)

    const origin = base
    const boot = await fetch(`${base}/api/bootstrap`, {
      method: 'POST',
      headers: { Origin: origin },
    })
    assert.equal(boot.status, 200)
    const { token } = await boot.json()
    assert.ok(token)
    const backups = await fetch(`${base}/api/update/backups`, {
      headers: { 'X-ACW-Token': token, Origin: origin },
    })
    assert.equal(backups.status, 200)
    const list = await backups.json()
    assert.ok(Array.isArray(list.backups))
    const beforeCount = list.backups.length

    const created = await fetch(`${base}/api/update/backup`, {
      method: 'POST',
      headers: { 'X-ACW-Token': token, Origin: origin },
    })
    assert.equal(created.status, 200)
    const backup = await created.json()
    assert.equal(backup.ok, true)
    assert.ok(backup.path || backup.format)

    const backups2 = await fetch(`${base}/api/update/backups`, {
      headers: { 'X-ACW-Token': token, Origin: origin },
    })
    const list2 = await backups2.json()
    assert.ok(list2.backups.length >= beforeCount + 1)

    const backupName = path.basename(String(backup.path || ''))
    assert.ok(/^acw-backup-/.test(backupName))

    const restored = await fetch(`${base}/api/update/restore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ACW-Token': token,
        Origin: origin,
      },
      body: JSON.stringify({ filename: backupName }),
    })
    assert.equal(restored.status, 200)
    const restoreBody = await restored.json()
    assert.equal(restoreBody.ok, true)

    const healthAfter = await fetch(`${base}/api/health`)
    assert.equal(healthAfter.status, 200)

    const sessionsRes = await fetch(`${base}/api/sessions`, {
      headers: { 'X-ACW-Token': token, Origin: origin },
    })
    assert.equal(sessionsRes.status, 200)
    const sessionsBody = await sessionsRes.json()
    assert.ok(Array.isArray(sessionsBody))

    const authHeaders = {
      'Content-Type': 'application/json',
      'X-ACW-Token': token,
      Origin: origin,
    }
    const memberRes = await fetch(`${base}/api/members`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: `e2e-${Date.now()}`,
        display_name: 'E2E Echo',
        kind: 'echo',
        workFolder: root,
        config: { defaultText: 'ok' },
      }),
    })
    assert.equal(memberRes.status, 201)
    const member = await memberRes.json()
    const sessRes = await fetch(`${base}/api/members/${member.id}/sessions`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    })
    assert.equal(sessRes.status, 201)
    const session = await sessRes.json()
    assert.ok(session.id)

    const termsRes = await fetch(`${base}/api/sessions/${session.id}/terminals`, {
      headers: { 'X-ACW-Token': token, Origin: origin },
    })
    assert.equal(termsRes.status, 200)
    const termsBody = await termsRes.json()
    assert.ok(Array.isArray(termsBody.terminals))

    const dismissGuide = await fetch(`${base}/api/settings/app`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ onboarding: { firstRunGuideDismissed: true } }),
    })
    assert.equal(dismissGuide.status, 200)

    await page.goto(`${base}/workbench`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    const primaryNav = page.getByRole('navigation', { name: /主导航|Primary navigation/i })
    await primaryNav.waitFor({ state: 'visible', timeout: 15000 })

    await page.goto(`${base}/workbench/${session.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await page.waitForTimeout(1200)
    const firstRunBtn = page.getByRole('button', { name: /开始探索/ })
    if (await firstRunBtn.isVisible().catch(() => false)) {
      await firstRunBtn.click()
      await page.waitForTimeout(400)
    }
    const chatSearchBtn = page.getByRole('button', {
      name: /搜索本会话聊天|Search this session/i,
    })
    await chatSearchBtn.waitFor({ state: 'visible', timeout: 15000 })

    const composer = page.getByRole('region', { name: /消息输入区|Message composer/i })
    await composer.waitFor({ state: 'visible', timeout: 30000 })
    const footerToggle = page.locator('.footer-toggle').first()
    if ((await footerToggle.getAttribute('aria-expanded')) === 'false') {
      await footerToggle.click()
    }
    const chatSel =
      '[contenteditable="true"], .elx-x-sender [contenteditable], [class*="x-sender"] [contenteditable]'
    await page.waitForSelector(chatSel, { timeout: 30000 })
    const marker = `e2e-smoke-${Date.now()}`
    const editor = page.locator(chatSel).first()
    await editor.click()
    const sendWait = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/sessions/${session.id}/messages`) &&
        r.request().method() === 'POST',
      { timeout: 20000 },
    )
    await page.keyboard.type(marker, { delay: 12 })
    await page.keyboard.press('Enter')
    const sendRes = await sendWait
    assert.equal(sendRes.status(), 200, 'composer Enter should POST message')

    await page.goto(`${base}/docs`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    const docsWelcome = page.getByRole('region', {
      name: /文档中心欢迎区|Docs hub welcome/i,
    })
    await docsWelcome.waitFor({ state: 'visible', timeout: 15000 })
    const docsSearch = page.locator('input[aria-label*="搜索"], input[aria-label*="Search"]')
    assert.equal(await docsSearch.count(), 1, 'docs hub search input aria-label')

    console.log('[ci-e2e-smoke] ok', base)
  } finally {
    if (browser) await browser.close().catch(() => {})
    shutdownChild()
    await new Promise((r) => setTimeout(r, 300))
    try {
      fs.rmSync(dataRoot, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error(err)
  shutdownChild()
  process.exit(1)
})
