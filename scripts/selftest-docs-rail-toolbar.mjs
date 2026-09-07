/**
 * 工作台第三栏文档中心工具栏：窄宽换行，标题保持横排。
 * Usage: node scripts/selftest-docs-rail-toolbar.mjs
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vueSrc = fs.readFileSync(
  path.join(root, 'web/src/views/workbench/components/FlowRail.vue'),
  'utf8',
)
const styleMatch = vueSrc.match(/<style scoped>([\s\S]*?)<\/style>/)
if (!styleMatch) throw new Error('FlowRail.vue 缺少 style')
const docsCss = [...styleMatch[1].matchAll(/\.(docs-rail-[\w-]+)[\s\S]*?\}/g)]
  .map((m) => m[0])
  .join('\n')
const artifactDir = '/opt/cursor/artifacts'

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
body { margin: 0; font-family: system-ui, sans-serif; background: #ece8f4; }
.frame {
  width: 260px;
  padding: 10px 0;
  background: rgba(255,255,255,0.55);
  border-radius: 14px;
}
.docs-rail-logo {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #4a7dff;
  flex-shrink: 0;
}
.docs-rail-actions button {
  border: 1px solid rgba(0,0,0,0.12);
  background: #fff;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
}
${docsCss}
</style>
</head>
<body>
<div class="frame">
  <div class="docs-rail-toolbar" id="toolbar">
    <div class="docs-rail-title-wrap" id="title-wrap">
      <div class="docs-rail-logo"></div>
      <span class="docs-rail-title" id="title">文档中心</span>
    </div>
    <div class="docs-rail-actions" id="actions">
      <button type="button">新标签打开</button>
      <button type="button">导出群</button>
      <button type="button">刷新</button>
    </div>
  </div>
</div>
</body>
</html>`

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 300, height: 160 } })
  await page.setContent(html, { waitUntil: 'load' })

  const metrics = await page.evaluate(`(() => {
    const title = document.getElementById('title')
    const wrap = document.getElementById('title-wrap')
    const actions = document.getElementById('actions')
    const toolbar = document.getElementById('toolbar')
    const t = title.getBoundingClientRect()
    const a = actions.getBoundingClientRect()
    const tb = toolbar.getBoundingClientRect()
    return {
      titleHeight: Math.round(t.height),
      titleWidth: Math.round(t.width),
      titleText: getComputedStyle(title).whiteSpace,
      wrapWidth: Math.round(wrap.getBoundingClientRect().width),
      actionsLeft: Math.round(a.left),
      toolbarLeft: Math.round(tb.left),
      actionsTop: Math.round(a.top),
      titleTop: Math.round(t.top),
      toolbarHeight: Math.round(tb.height),
      wrapped: a.top > t.bottom - 2,
    }
  })()`)

  assert.equal(metrics.titleText, 'nowrap', `标题应 nowrap ${JSON.stringify(metrics)}`)
  assert.ok(metrics.titleHeight <= 24, `标题不应竖排叠字 ${JSON.stringify(metrics)}`)
  assert.ok(metrics.titleWidth >= 48, `标题应横向排开 ${JSON.stringify(metrics)}`)
  assert.equal(metrics.wrapped, true, `窄栏按钮应换到下一行 ${JSON.stringify(metrics)}`)
  assert.ok(
    Math.abs(metrics.actionsLeft - metrics.toolbarLeft) <= 4,
    `换行后按钮应左对齐 ${JSON.stringify(metrics)}`,
  )
  console.log('DOCS_RAIL_WRAP_OK', metrics)

  try {
    fs.mkdirSync(artifactDir, { recursive: true })
    await page.screenshot({ path: path.join(artifactDir, 'docs_rail_toolbar_wrap.png') })
  } catch {
    /* 产物目录不可写时跳过 */
  }

  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
