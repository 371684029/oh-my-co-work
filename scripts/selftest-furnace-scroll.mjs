/**
 * 熔炉 GUI / TUI 滚动骨架自测（不需要 grok 进程）。
 * Usage: node scripts/selftest-furnace-scroll.mjs
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const layoutCss = fs.readFileSync(
  path.join(root, 'web/src/components/terminal/furnaceLayout.css'),
  'utf8',
)

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
html, body { height: 100%; margin: 0; overflow: hidden; }
${layoutCss}
.furnace-head, .furnace-foot, .furnace-composer { background: #ddd; padding: 8px; }
.furnace-log { padding: 12px; background: #f4f6f9; }
.furnace-tui { background: #17191f; }
.tui-fake {
  flex: 1 1 0%;
  min-height: 0;
  overflow-y: scroll;
  color: #eee;
  padding: 8px;
}
</style>
</head>
<body>
<section id="gui" class="furnace-workspace is-pagefill is-chat">
  <header class="furnace-head">返回群聊 · GUI</header>
  <div class="furnace-chat">
    <div class="furnace-log" id="gui-log">
      <aside class="furnace-buddy">buddy</aside>
      <div class="furnace-thread" id="gui-thread"></div>
    </div>
    <form class="furnace-composer">输入框固定</form>
  </div>
  <footer class="furnace-foot">满屏 · GUI</footer>
</section>
<section id="tui" class="furnace-workspace is-pagefill" style="display:none">
  <header class="furnace-head">返回群聊 · TUI</header>
  <div class="furnace-tui">
    <div class="tui-fake" id="tui-log"></div>
  </div>
  <footer class="furnace-foot">满屏 · TUI</footer>
</section>
</body>
</html>`

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await page.setContent(html, { waitUntil: 'load' })
  await page.evaluate(`(() => {
    const thread = document.getElementById('gui-thread')
    thread.innerHTML = Array.from({ length: 40 }, (_, i) => '<p>历史 ' + (i + 1) + '：' + '段落 '.repeat(24) + '</p>').join('')
    const tui = document.getElementById('tui-log')
    tui.innerHTML = Array.from({ length: 80 }, (_, i) => '<div>TUI line ' + (i + 1) + '</div>').join('')
  })()`)

  const gui = await page.evaluate(`(() => {
    const log = document.getElementById('gui-log')
    const head = document.querySelector('#gui .furnace-head').getBoundingClientRect()
    const foot = document.querySelector('#gui .furnace-foot').getBoundingClientRect()
    const composer = document.querySelector('#gui .furnace-composer').getBoundingClientRect()
    const box = log.getBoundingClientRect()
    const before = {
      canScroll: log.scrollHeight > log.clientHeight + 1,
      scrollTop: log.scrollTop,
      logTop: Math.round(box.top),
      logBottom: Math.round(box.bottom),
      headBottom: Math.round(head.bottom),
      composerTop: Math.round(composer.top),
      footTop: Math.round(foot.top),
      vh: window.innerHeight,
    }
    log.scrollTop = 240
    return Object.assign(before, { scrolled: log.scrollTop })
  })()`)

  assert.equal(gui.canScroll, true, `GUI 应能滚 scrollHeight>clientHeight ${JSON.stringify(gui)}`)
  assert.ok(gui.scrolled >= 200, `GUI scrollTop 应变 ${JSON.stringify(gui)}`)
  assert.ok(gui.logTop >= gui.headBottom - 1, 'GUI 顶栏应固定在对话区之上')
  assert.ok(gui.logBottom <= gui.composerTop + 1, 'GUI 输入区应固定在对话区之下')
  assert.ok(gui.footTop < gui.vh, 'GUI 底栏应在视口内')
  console.log('GUI_SCROLL_OK', gui)

  await page.evaluate(`(() => {
    document.getElementById('gui').style.display = 'none'
    document.getElementById('tui').style.display = 'flex'
  })()`)

  const tui = await page.evaluate(`(() => {
    const log = document.getElementById('tui-log')
    const head = document.querySelector('#tui .furnace-head').getBoundingClientRect()
    const foot = document.querySelector('#tui .furnace-foot').getBoundingClientRect()
    const box = log.getBoundingClientRect()
    const before = {
      canScroll: log.scrollHeight > log.clientHeight + 1,
      scrollTop: log.scrollTop,
      logTop: Math.round(box.top),
      logBottom: Math.round(box.bottom),
      headBottom: Math.round(head.bottom),
      footTop: Math.round(foot.top),
      vh: window.innerHeight,
    }
    log.scrollTop = 320
    return Object.assign(before, { scrolled: log.scrollTop })
  })()`)

  assert.equal(tui.canScroll, true, `TUI 应能滚 ${JSON.stringify(tui)}`)
  assert.ok(tui.scrolled >= 200, `TUI scrollTop 应变 ${JSON.stringify(tui)}`)
  assert.ok(tui.logTop >= tui.headBottom - 1, 'TUI 顶栏应固定')
  assert.ok(tui.logBottom <= tui.footTop + 1, 'TUI 底栏应固定')
  console.log('TUI_SCROLL_OK', tui)

  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
