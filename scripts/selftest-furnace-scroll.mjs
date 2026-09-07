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
const artifactDir = process.env.CURSOR_WALKTHROUGH_DIR || path.join(root, 'tmp')

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
.furnace-tui-toggle {
  border: 0;
  padding: 0;
  color: #c5c9d3;
  background: #1f232c;
  cursor: pointer;
}
.furnace-tui-drawer { padding: 10px 12px; background: #12141a; color: #d6d8de; }
.tui-fake {
  flex: 1 1 0%;
  min-height: 0;
  height: 100%;
  color: #eee;
  padding: 8px;
  overflow: hidden;
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
    <div class="furnace-tui-stage">
      <div class="tui-fake" id="tui-stage">native grok surface</div>
    </div>
    <aside class="furnace-tui-rail" id="tui-rail">
      <button type="button" class="furnace-tui-toggle" id="tui-toggle">‹</button>
      <div id="tui-drawer" class="furnace-tui-drawer" style="display:none"></div>
    </aside>
  </div>
  <footer class="furnace-foot">满屏 · TUI</footer>
</section>
</body>
</html>`

async function screenshot(page, name) {
  try {
    fs.mkdirSync(artifactDir, { recursive: true })
    await page.screenshot({ path: path.join(artifactDir, name), fullPage: false })
  } catch {
    /* 没有产物目录时跳过截图，不影响断言 */
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await page.setContent(html, { waitUntil: 'load' })
  await page.evaluate(`(() => {
    const thread = document.getElementById('gui-thread')
    thread.innerHTML = Array.from({ length: 40 }, (_, i) => '<p>历史 ' + (i + 1) + '：' + '段落 '.repeat(24) + '</p>').join('')
    const drawer = document.getElementById('tui-drawer')
    drawer.innerHTML = '<div class="furnace-tui-drawer-head">对话记录</div>' +
      Array.from({ length: 80 }, (_, i) => '<div class="furnace-tui-line"><span>Grok</span><pre>历史 ' + (i + 1) + ' ' + '段落 '.repeat(8) + '</pre></div>').join('')
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
  await screenshot(page, 'furnace-gui-scroll.png')

  await page.evaluate(`(() => {
    document.getElementById('gui').style.display = 'none'
    document.getElementById('tui').style.display = 'flex'
  })()`)

  const collapsed = await page.evaluate(`(() => {
    const stage = document.getElementById('tui-stage').getBoundingClientRect()
    const drawer = document.getElementById('tui-drawer')
    const head = document.querySelector('#tui .furnace-head').getBoundingClientRect()
    const foot = document.querySelector('#tui .furnace-foot').getBoundingClientRect()
    return {
      stageTop: Math.round(stage.top),
      stageBottom: Math.round(stage.bottom),
      stageWidth: Math.round(stage.width),
      drawerDisplay: getComputedStyle(drawer).display,
      headBottom: Math.round(head.bottom),
      footTop: Math.round(foot.top),
      vh: window.innerHeight,
      vw: window.innerWidth,
    }
  })()`)

  assert.equal(collapsed.drawerDisplay, 'none', `默认应收起抽屉 ${JSON.stringify(collapsed)}`)
  assert.ok(collapsed.stageTop >= collapsed.headBottom - 1, 'TUI 顶栏应固定')
  assert.ok(collapsed.stageBottom <= collapsed.footTop + 1, 'TUI 底栏应固定')
  assert.ok(collapsed.stageWidth > collapsed.vw * 0.9, `收起时终端应几乎铺满 ${JSON.stringify(collapsed)}`)
  console.log('TUI_COLLAPSED_OK', collapsed)
  await screenshot(page, 'furnace-tui-collapsed.png')

  const opened = await page.evaluate(`(() => {
    const drawer = document.getElementById('tui-drawer')
    const toggle = document.getElementById('tui-toggle')
    drawer.style.display = 'block'
    toggle.textContent = '›'
    const stage = document.getElementById('tui-stage').getBoundingClientRect()
    const box = drawer.getBoundingClientRect()
    const head = document.querySelector('#tui .furnace-head').getBoundingClientRect()
    const foot = document.querySelector('#tui .furnace-foot').getBoundingClientRect()
    const before = {
      canScroll: drawer.scrollHeight > drawer.clientHeight + 1,
      stageWidth: Math.round(stage.width),
      drawerWidth: Math.round(box.width),
      drawerTop: Math.round(box.top),
      drawerBottom: Math.round(box.bottom),
      headBottom: Math.round(head.bottom),
      footTop: Math.round(foot.top),
      vh: window.innerHeight,
    }
    drawer.scrollTop = 320
    return Object.assign(before, { scrolled: drawer.scrollTop })
  })()`)

  assert.equal(opened.canScroll, true, `抽屉应能滚 ${JSON.stringify(opened)}`)
  assert.ok(opened.scrolled >= 200, `抽屉 scrollTop 应变 ${JSON.stringify(opened)}`)
  assert.ok(opened.drawerTop >= opened.headBottom - 1, '展开后顶栏应固定')
  assert.ok(opened.drawerBottom <= opened.footTop + 1, '展开后底栏应固定')
  assert.ok(opened.drawerWidth >= 200, `抽屉应有可读宽度 ${JSON.stringify(opened)}`)
  assert.ok(opened.stageWidth > 400, `展开后终端仍应有宽度 ${JSON.stringify(opened)}`)
  console.log('TUI_DRAWER_OK', opened)
  await screenshot(page, 'furnace-tui-drawer.png')

  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
