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
