/**
 * CI：启动真实 server + 已构建 web/dist，Playwright 全站关键路径冒烟。
 *
 * 覆盖面：
 * - 首页无障碍 skip-link / #main-content
 * - 备份创建 → 列表 → 还原往返（/api/update/*）
 * - 成员/会话创建、终端列表、onboarding 关闭
 * - composer 发消息（POST /api/sessions/:id/messages）
 * - 文档中心（/docs 欢迎区 + 搜索框）
 * - PTY：ACW_E2E_SMOKE 门控 spawn-terminal + replay 回显
 * - QA-01 全站路由（见下方 QA-01 注释块）：设置页导航 + 偏好保存往返、
 *   还原中心、docs 外壳、多会话切换
 *
 * 前置：npm run build -w web
 * 门控：ACW_E2E_SMOKE=1（spawn-terminal 等 e2e 专用路由仅此时开放，见
 *       server/test/e2eSmokeSpawnRoute.test.js）
 * 跳过约定：playwright 是可选 dev 依赖——未安装或 Chromium 不可用时，
 *          浏览器步骤打印 SKIP 原因并以 exit 0 结束；API 步骤（备份/会话/
 *          spawn replay）不依赖浏览器，仍会执行。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const webIndex = path.join(root, 'web/dist/index.html')
if (!fs.existsSync(webIndex)) {
  console.error('[ci-e2e-smoke] missing web/dist — run npm run build -w web first')
  process.exit(1)
}

/** Playwright is an optional dev dep — browser steps SKIP when missing. */
let chromium = null
try {
  ;({ chromium } = await import('playwright'))
} catch {
  /* browser steps will be skipped with a SKIP log */
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-e2e-'))
const port = 3870 + Math.floor(Math.random() * 80)

const child = spawn(process.execPath, ['server/src/index.js'], {
  cwd: root,
  env: {
    ...process.env,
    ACW_DATA_ROOT: dataRoot,
    ACW_PORT: String(port),
    ACW_E2E_SMOKE: '1',
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

/** Launch headless Chromium, or return null with a SKIP log (exit 0 convention). */
async function launchBrowser() {
  if (!chromium) {
    console.log(
      '[ci-e2e-smoke] SKIP browser steps: playwright 未安装（可选 dev 依赖；' +
        'npm install && npx playwright install chromium）— API 步骤照常执行',
    )
    return null
  }
  try {
    return await chromium.launch({ headless: true })
  } catch (e) {
    console.log(
      `[ci-e2e-smoke] SKIP browser steps: Chromium 不可用（${e?.message || e}）— ` +
        '执行 npx playwright install chromium',
    )
    return null
  }
}

/** Dismiss the first-run guide overlay when present (same pattern as inline blocks below). */
async function dismissFirstRunIfVisible(page) {
  try {
    const btn = page.getByRole('button', { name: /开始探索|Start exploring/i })
    if (await btn.isVisible()) {
      await btn.click()
      await page.waitForTimeout(400)
    }
  } catch {
    /* no first-run overlay */
  }
}

async function main() {
  let browser
  try {
    const base = await waitHealth()

    // ── API 阶段（不依赖浏览器；playwright 缺失时仍执行） ─────────────────

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

    // PTY spawn（ACW_E2E_SMOKE 门控路由）+ replay 轮询——无浏览器也可验证
    const spawnRes = await fetch(`${base}/api/sessions/${session.id}/e2e/spawn-terminal`, {
      method: 'POST',
      headers: authHeaders,
    })
    assert.equal(spawnRes.status, 200, 'e2e spawn-terminal should succeed')
    const spawnBody = await spawnRes.json()
    assert.ok(spawnBody.terminalId, 'spawn should return terminalId')

    let spawnedTerm = null
    for (let i = 0; i < 40; i++) {
      const termsRes = await fetch(`${base}/api/sessions/${session.id}/terminals`, {
        headers: { 'X-ACW-Token': token, Origin: origin },
      })
      const termsBody = await termsRes.json()
      spawnedTerm = (termsBody.terminals || []).find((t) => t.id === spawnBody.terminalId)
      if (spawnedTerm?.replay?.includes('ACW_E2E_READY')) break
      await sleep(250)
    }
    assert.ok(
      spawnedTerm?.replay?.includes('ACW_E2E_READY'),
      'spawned PTY should emit ACW_E2E_READY in replay',
    )

    // ── 浏览器阶段（playwright / Chromium 缺失时 SKIP 并 exit 0） ─────────

    browser = await launchBrowser()
    if (!browser) {
      console.log('[ci-e2e-smoke] ok (api-only, browser steps skipped)', base)
      return
    }
    const page = await browser.newPage()

    await page.goto(base, { waitUntil: 'load', timeout: 60000 })
    const skip = page.locator('a.skip-link')
    assert.equal(await skip.count(), 1)
    const text = (await skip.textContent()) || ''
    assert.match(text, /主内容/)
    const main = page.locator('#main-content')
    assert.equal(await main.count(), 1)

    await page.goto(`${base}/workbench`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    const primaryNav = page.getByRole('navigation', { name: /主导航|Primary navigation/i })
    await primaryNav.waitFor({ state: 'visible', timeout: 15000 })

    await page.goto(`${base}/workbench/${session.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await page.waitForTimeout(1200)
    const firstRunBtn = page.getByRole('button', { name: /开始探索|Start exploring/i })
    if (await firstRunBtn.isVisible().catch(() => false)) {
      await firstRunBtn.click()
      await page.waitForTimeout(400)
    }
    const chatSearchBtn = page.getByRole('button', {
      name: /搜索本会话聊天|Search this session/i,
    })
    await chatSearchBtn.waitFor({ state: 'visible', timeout: 15000 })

    const startTargetSelect = page.getByRole('combobox', {
      name: /选择群模板或成员|Choose a group template or member/i,
    })
    await startTargetSelect.waitFor({ state: 'visible', timeout: 15000 })

    const composer = page.getByRole('region', { name: /消息输入区|Message composer/i })
    await composer.waitFor({ state: 'visible', timeout: 30000 })
    const attachBtn = composer.getByRole('button', { name: /^附件$|^Attach$/ })
    await attachBtn.waitFor({ state: 'visible', timeout: 15000 })
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
    const docsFirstRunEarly = page.getByRole('button', { name: /开始探索|Start exploring/i })
    if (await docsFirstRunEarly.isVisible().catch(() => false)) {
      await docsFirstRunEarly.click()
      await page.waitForTimeout(400)
    }
    const docsWelcome = page.getByRole('region', {
      name: /文档中心欢迎区|Docs hub welcome/i,
    })
    await docsWelcome.waitFor({ state: 'visible', timeout: 15000 })
    const docsSearch = page.locator('input[aria-label*="搜索"], input[aria-label*="Search"]')
    assert.equal(await docsSearch.count(), 1, 'docs hub search input aria-label')

    await page.goto(`${base}/workbench/${session.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await page.waitForTimeout(800)

    const enterTerminal = page.getByRole('button', {
      name: /进入终端|查看终端|Enter terminal|View terminal/i,
    })
    await enterTerminal.waitFor({ state: 'visible', timeout: 45000 })
    await enterTerminal.click()
    await page.waitForTimeout(2500)
    await page.locator('.terminal-view .xterm-screen').waitFor({ state: 'visible', timeout: 20000 })
    await page.locator('.terminal-view .xterm-screen').click()
    const xtermInput = page.locator('.terminal-view .xterm-helper-textarea')
    await xtermInput.waitFor({ state: 'attached', timeout: 20000 })
    await page.locator('.terminal-view').waitFor({ state: 'visible', timeout: 20000 })
    const echoMarker = 'e2eZ9'
    await xtermInput.pressSequentially(`${echoMarker}\n`, { force: true })

    let replayHasEcho = false
    for (let i = 0; i < 40; i++) {
      const termsRes = await fetch(`${base}/api/sessions/${session.id}/terminals`, {
        headers: { 'X-ACW-Token': token, Origin: origin },
      })
      const termsBody = await termsRes.json()
      const term = (termsBody.terminals || []).find((t) => t.id === spawnBody.terminalId)
      if (term?.replay?.includes(echoMarker)) {
        replayHasEcho = true
        break
      }
      await page.waitForTimeout(250)
    }
    assert.ok(replayHasEcho, 'PTY typed input should appear in terminal replay')
    // xterm paints to canvas; Playwright cannot assert glyph text in .xterm-screen.

    await fetch(`${base}/api/sessions/${session.id}/terminals/${spawnBody.terminalId}/kill`, {
      method: 'POST',
      headers: authHeaders,
    })
    const backToChat = page.getByRole('button', { name: /返回对话|Back to chat/i })
    if (await backToChat.isVisible().catch(() => false)) {
      await backToChat.click()
      await page.waitForTimeout(400)
    }

    // ─────────────────────────────────────────────────────────────────────
    // QA-01 全站关键路径（docs/5.5.0-plan.md「全站 E2E（多路由、设置保存、
    // 还原中心）待补」）
    //
    // 新增步骤（仅浏览器可用时执行；否则随上面的 SKIP 一起跳过并 exit 0）：
    //   (1) /settings/members —— 设置侧栏导航壳 + 成员管理页主标题渲染
    //        （h2.page-title，i18n 稳定文案：成员管理|Members）
    //   (2) /settings/prefs   —— 设置保存往返：点侧栏进入偏好页，UI 切换无害偏好
    //        「显示演示示例」(showDemo)，断言 PATCH /api/settings/app 200 →
    //        GET 持久化翻转 → reload 后开关状态一致 → API 还原原值（不留副作用）
    //   (3) /settings/restore —— 还原中心可见：role=region 外壳 + 标题，且
    //        「成员炼化备份」列表区块（.restore-section）渲染出 API 创建的成员行
    //   (4) /docs             —— 文档中心外壳：欢迎区 region + 路由落地
    //        （搜索框等深度断言在上方 docs 步骤，此处不重复）
    //   (5) /workbench 多会话切换 —— 新建第二成员+会话（createSessionFromMember
    //        按成员复用单聊会话，故必须新建成员），A→B→A 两次路由切换均断言
    //        GET /api/sessions/:id 详情往返 + 会话外壳（聊天搜索按钮）渲染
    //
    // 选择器约定：仓库未使用 data-testid（web/** 本波不改动），统一走
    // role/aria-label + i18n 稳定文案（中英双语正则），与脚本既有断言一致。
    // 认证：沿用脚本既有的 /api/bootstrap token（authHeaders）。
    // ─────────────────────────────────────────────────────────────────────

    // (1) 设置页导航：/settings/members 主标题
    await page.goto(`${base}/settings/members`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await dismissFirstRunIfVisible(page)
    await page.waitForURL('**/settings/members', { timeout: 15000 })
    const membersHeading = page.locator('h2.page-title')
    await membersHeading.waitFor({ state: 'visible', timeout: 15000 })
    assert.match((await membersHeading.textContent()) || '', /成员管理|Members/)
    await page.locator('aside.settings-side').waitFor({ state: 'visible', timeout: 15000 })

    // (2) /settings/prefs 设置保存往返（showDemo：无害显示偏好）
    const prefsNavItem = page
      .locator('.settings-menu--meta .el-menu-item')
      .filter({ hasText: /设置|Preferences/ })
      .first()
    await prefsNavItem.waitFor({ state: 'visible', timeout: 15000 })
    await prefsNavItem.click()
    await page.waitForURL('**/settings/prefs', { timeout: 15000 })
    const prefsHeading = page.locator('h2.page-title')
    await prefsHeading.waitFor({ state: 'visible', timeout: 15000 })
    assert.match((await prefsHeading.textContent()) || '', /设置|Preferences/)

    const settingsBefore = await (
      await fetch(`${base}/api/settings/app`, {
        headers: { 'X-ACW-Token': token, Origin: origin },
      })
    ).json()
    const showDemoBefore = settingsBefore.showDemo !== false

    const demoSwitch = page
      .locator('.prefs-row')
      .filter({ hasText: /显示演示示例|Show demo examples/ })
      .locator('.el-switch')
      .first()
    await demoSwitch.waitFor({ state: 'visible', timeout: 15000 })
    const patchWait = page.waitForResponse(
      (r) => r.url().includes('/api/settings/app') && r.request().method() === 'PATCH',
      { timeout: 15000 },
    )
    await demoSwitch.click()
    const patchRes = await patchWait
    assert.equal(patchRes.status(), 200, 'prefs toggle should PATCH /api/settings/app')

    const settingsAfter = await (
      await fetch(`${base}/api/settings/app`, {
        headers: { 'X-ACW-Token': token, Origin: origin },
      })
    ).json()
    assert.equal(
      settingsAfter.showDemo !== false,
      !showDemoBefore,
      'showDemo should flip after UI toggle (API persistence)',
    )

    // reload 后开关状态应与持久化值一致
    await page.goto(`${base}/settings/prefs`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    const demoSwitchInput = page
      .locator('.prefs-row')
      .filter({ hasText: /显示演示示例|Show demo examples/ })
      .locator('input[role="switch"]')
      .first()
    await demoSwitchInput.waitFor({ state: 'attached', timeout: 15000 })
    let reloadedChecked = null
    for (let i = 0; i < 30; i++) {
      reloadedChecked = await demoSwitchInput.evaluate(
        (el) => el.getAttribute('aria-checked') === 'true',
      )
      if (reloadedChecked === !showDemoBefore) break
      await sleep(200)
    }
    assert.equal(
      reloadedChecked,
      !showDemoBefore,
      'reloaded prefs switch state should match persisted showDemo',
    )

    // 还原原值，不给数据根留下测试副作用
    const restoreShowDemo = await fetch(`${base}/api/settings/app`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ showDemo: showDemoBefore }),
    })
    assert.equal(restoreShowDemo.status, 200, 'should restore original showDemo value')

    // (3) /settings/restore 还原中心：外壳 + 成员炼化备份列表区块
    const restoreNavItem = page
      .locator('.settings-menu--meta .el-menu-item')
      .filter({ hasText: /还原中心|Restore center/ })
      .first()
    await restoreNavItem.waitFor({ state: 'visible', timeout: 15000 })
    await restoreNavItem.click()
    await page.waitForURL('**/settings/restore', { timeout: 15000 })
    const restoreRegion = page.locator('.restore-center[role="region"]')
    await restoreRegion.waitFor({ state: 'visible', timeout: 15000 })
    const restoreHeading = page.locator('#restore-center-title')
    assert.match((await restoreHeading.textContent()) || '', /还原中心|Restore center/)
    const backupSection = page
      .locator('.restore-section')
      .filter({ hasText: /成员炼化备份|Member refine backups/ })
      .first()
    await backupSection.waitFor({ state: 'visible', timeout: 15000 })
    assert.ok(
      (await backupSection.locator('li').count()) >= 1,
      'restore center backup list should render rows',
    )
    assert.ok(
      (await backupSection.getByText(member.display_name).count()) >= 1,
      'restore center backup list should include the API-created member',
    )

    // (4) /docs 文档中心外壳（深度断言见上方 docs 步骤，此处不重复）
    await page.goto(`${base}/docs`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await dismissFirstRunIfVisible(page)
    const docsShell = page.getByRole('region', {
      name: /文档中心欢迎区|Docs hub welcome/i,
    })
    await docsShell.waitFor({ state: 'visible', timeout: 15000 })
    assert.ok(page.url().includes('/docs'), 'docs hub route should resolve')

    // (5) /workbench 多会话切换 A→B→A
    const member2Res = await fetch(`${base}/api/members`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: `e2e2-${Date.now()}`,
        display_name: 'E2E Echo B',
        kind: 'echo',
        workFolder: root,
        config: { defaultText: 'ok' },
      }),
    })
    assert.equal(member2Res.status, 201)
    const member2 = await member2Res.json()
    const sess2Res = await fetch(`${base}/api/members/${member2.id}/sessions`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ title: `e2e-switch-${Date.now()}` }),
    })
    assert.equal(sess2Res.status, 201)
    const session2 = await sess2Res.json()
    assert.ok(session2.id, 'second session should be created')
    assert.notEqual(session2.id, session.id, 'second session must be a distinct session')

    async function gotoWorkbenchSession(id) {
      const detailWait = page.waitForResponse(
        (r) =>
          r.request().method() === 'GET' &&
          r.url().split('?')[0].endsWith(`/api/sessions/${id}`) &&
          r.status() === 200,
        { timeout: 30000 },
      )
      await page.goto(`${base}/workbench/${id}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
      await detailWait
      await dismissFirstRunIfVisible(page)
      assert.ok(page.url().includes(`/workbench/${id}`), `URL should land on session ${id}`)
      await page
        .getByRole('button', { name: /搜索本会话聊天|Search this session/i })
        .waitFor({ state: 'visible', timeout: 20000 })
    }
    await gotoWorkbenchSession(session2.id) // A → B
    await gotoWorkbenchSession(session.id) // B → A
    // ─────────────────────────────────────────────────────────────────────

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
