/**
 * Self-test: XSender Enter sends message
 * Usage: node scripts/test-enter-send.mjs
 */
import { chromium } from 'playwright'

const WEB = process.env.WEB_URL || 'http://localhost:5173'
const API = process.env.API_URL || 'http://localhost:3780/api'

async function api(path, opts = {}) {
  const r = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`${path} ${r.status}: ${JSON.stringify(data)}`)
  return data
}

async function main() {
  const groups = await api('/groups')
  const g = groups.find((x) => x.title?.includes('演示')) || groups[0]
  if (!g) throw new Error('no group templates')
  const session = await api(`/groups/${g.id}/sessions`, { method: 'POST', body: '{}' })
  console.log('session', session.id, session.status)

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('CONSOLE_ERR', m.text())
  })
  page.on('pageerror', (e) => console.log('PAGE_ERR', e.message))

  await page.goto(`${WEB}/workbench/${session.id}`, {
    waitUntil: 'networkidle',
    timeout: 30000,
  })
  await page.waitForTimeout(1500)

  const chatSel = [
    '[contenteditable="true"]',
    '.elx-x-sender [contenteditable]',
    '[class*="x-sender"] [contenteditable]',
    '[class*="chat-room"] [contenteditable]',
  ].join(', ')

  const count = await page.locator(chatSel).count()
  console.log('editor candidates', count)
  if (count === 0) {
    const html = await page.locator('.composer-shell').innerHTML().catch(() => 'no composer')
    console.log('composer snippet', String(html).slice(0, 800))
    throw new Error('no editor found')
  }

  const editor = page.locator(chatSel).first()
  await editor.click()
  await page.waitForTimeout(200)

  const marker = `ENTER_SEND_TEST_${Date.now()}`
  await page.keyboard.type(marker, { delay: 15 })
  await page.waitForTimeout(400)

  // Enter to send
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2500)

  const detail = await api(`/sessions/${session.id}`)
  const texts = (detail.messages || []).map((m) => m.content?.text || '')
  const hit = texts.some((t) => String(t).includes(marker))
  console.log('messages_count', texts.length)
  console.log(
    'recent_user_or_all',
    texts.filter((t) => String(t).includes('ENTER_SEND') || String(t).includes('BTN_SEND')).concat(texts.slice(-3)),
  )
  console.log('ENTER_SEND_OK', hit)

  // Secondary: click send button
  const marker2 = `BTN_SEND_TEST_${Date.now()}`
  await editor.click()
  await page.keyboard.type(marker2, { delay: 15 })
  await page.waitForTimeout(300)
  const sendBtn = page.locator(
    '.elx-x-sender__action-list-presets button, .composer-shell button:not([disabled])',
  )
  const btnCount = await sendBtn.count()
  console.log('send_btn_count', btnCount)
  if (btnCount > 0) {
    await sendBtn.first().click()
    await page.waitForTimeout(2000)
  }
  const detail2 = await api(`/sessions/${session.id}`)
  const texts2 = (detail2.messages || []).map((m) => m.content?.text || '')
  const hit2 = texts2.some((t) => String(t).includes(marker2))
  console.log('BTN_SEND_OK', hit2)

  await browser.close()

  if (!hit) {
    console.error('FAIL: Enter did not send message')
    process.exit(1)
  }
  console.log('PASS: Enter send works')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
