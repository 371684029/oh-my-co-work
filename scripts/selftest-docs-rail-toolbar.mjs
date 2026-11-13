/**
 * 会话顶栏文档中心入口：标题行内紧凑按钮，不换行到会话标题区。
 * Usage: node scripts/selftest-docs-rail-toolbar.mjs
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vueSrc = fs.readFileSync(path.join(root, 'web/src/views/Workbench.vue'), 'utf8')
const styleMatch = vueSrc.match(/<style scoped>([\s\S]*?)<\/style>/)
if (!styleMatch) throw new Error('Workbench.vue 缺少 style')
const headerCss = [
  ...styleMatch[1].matchAll(
    /\.(wb-chat-header|header-actions|header-action-compact|header-docs-btn|header-docs-badge)[\s\S]*?\}/g,
  ),
]
  .map((m) => m[0])
  .join('\n')

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
body { margin: 0; font-family: system-ui, sans-serif; background: #ece8f4; }
.frame { width: 820px; padding: 8px; background: rgba(255,255,255,0.9); border-radius: 12px; }
.header-left { display: flex; flex: 1; min-width: 0; align-items: center; gap: 8px; }
.title-input { flex: 1; min-width: 120px; height: 32px; border: 1px solid rgba(0,0,0,0.08); border-radius: 8px; }
${headerCss}
</style>
</head>
<body>
<div class="frame">
  <div class="wb-chat-header">
    <div class="header-left">
      <input class="title-input" value="示例会话标题" />
    </div>
    <div class="header-actions">
      <button type="button" class="header-action-compact header-docs-btn">文档中心</button>
      <button type="button" class="header-action-compact">搜索聊天</button>
      <button type="button" class="header-action-compact">置顶</button>
    </div>
  </div>
</div>
</body>
</html>`

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 900, height: 120 } })
  await page.setContent(html, { waitUntil: 'load' })

  const metrics = await page.evaluate(`(() => {
    const header = document.querySelector('.wb-chat-header')
    const actions = document.querySelector('.header-actions')
    const docsBtn = document.querySelector('.header-docs-btn')
    const h = header.getBoundingClientRect()
    const a = actions.getBoundingClientRect()
  const d = docsBtn.getBoundingClientRect()
    const actionsMid = (a.top + a.bottom) / 2
    const headerMid = (h.top + h.bottom) / 2
    return {
      headerHeight: Math.round(h.height),
      docsBtnHeight: Math.round(d.height),
      actionsAligned: Math.abs(actionsMid - headerMid) < 6,
      docsInHeader: d.top >= h.top - 2 && d.bottom <= h.bottom + 2,
    }
  })()`)

  assert.ok(metrics.actionsAligned, `顶栏操作应垂直居中对齐 ${JSON.stringify(metrics)}`)
  assert.ok(metrics.docsInHeader, `文档中心按钮应在顶栏内 ${JSON.stringify(metrics)}`)
  assert.ok(metrics.headerHeight <= 72, `顶栏高度合理 ${JSON.stringify(metrics)}`)
  assert.equal(metrics.docsBtnHeight, 28, `文档中心按钮高度 ${JSON.stringify(metrics)}`)
  console.log('WORKBENCH_DOCS_HEADER_OK', metrics)

  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
