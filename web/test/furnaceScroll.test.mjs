import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const layoutCss = fs.readFileSync(path.join(root, 'src/components/terminal/furnaceLayout.css'), 'utf8')
const vueSrc = fs.readFileSync(path.join(root, 'src/components/terminal/FurnaceWorkspace.vue'), 'utf8')
const viewSrc = fs.readFileSync(path.join(root, 'src/components/terminal/TerminalView.vue'), 'utf8')
const hookSrc = fs.readFileSync(path.join(root, 'src/composables/useFurnaceWorkspace.js'), 'utf8')

test('熔炉默认隐藏 GUI 入口', () => {
  assert.match(vueSrc, /const guiEnabled = false/)
  assert.match(vueSrc, /v-if="guiEnabled"/)
})

test('GUI 对话区是独立滚动容器，不靠撑高整页', () => {
  assert.match(layoutCss, /\.furnace-log[\s\S]*flex:\s*1 1 0%/)
  assert.match(layoutCss, /\.furnace-log[\s\S]*overflow-y:\s*scroll/)
  assert.match(layoutCss, /\.furnace-log[\s\S]*min-height:\s*0/)
  assert.match(layoutCss, /\.furnace-chat[\s\S]*overflow:\s*hidden/)
  assert.match(vueSrc, /class="furnace-log"/)
  assert.match(vueSrc, /furnaceLayout\.css/)
  assert.doesNotMatch(vueSrc, /furnace-tui-history/)
})

test('TUI 历史走右侧抽屉，不抢 Grok 滚轮、不垫顶栏', () => {
  assert.match(layoutCss, /\.furnace-tui \{[\s\S]*flex-direction:\s*row/)
  assert.match(layoutCss, /\.furnace-tui-stage[\s\S]*flex:\s*1 1 0%/)
  assert.match(layoutCss, /\.furnace-tui-drawer[\s\S]*overflow-y:\s*scroll/)
  assert.match(layoutCss, /\.furnace-tui-toggle[\s\S]*width:\s*22px/)
  assert.match(vueSrc, /class="furnace-tui-toggle"/)
  assert.match(vueSrc, /class="furnace-tui-drawer"/)
  assert.match(vueSrc, /tuiHistoryOpen/)
  assert.match(vueSrc, /chatTurns/)
  assert.match(hookSrc, /右侧箭头展开记录/)
  assert.doesNotMatch(vueSrc, /preserve-history/)
  assert.doesNotMatch(vueSrc, /furnace-tui-history/)
  assert.doesNotMatch(viewSrc, /preserveHistory/)
  assert.doesNotMatch(viewSrc, /scrollLines/)
  assert.doesNotMatch(viewSrc, /1049/)
})

test('熔炉 Agent 快捷键只在熔炉内处理，并会 ensure-agent', () => {
  assert.match(vueSrc, /furnaceHotkeyTargeted/)
  assert.match(vueSrc, /setActiveAgent/)
  assert.match(vueSrc, /ensure-agent/)
  assert.match(vueSrc, /Ctrl\/Cmd\+1/)
})

test('xterm 尊重 prefs.scrollback 与 fontSize，不再强行抬到 10000', () => {
  assert.match(viewSrc, /Number\(prefs\.fontSize\) \|\| 13/)
  assert.match(viewSrc, /Number\(prefs\.scrollback\) > 0 \? Number\(prefs\.scrollback\) : 5000/)
  assert.doesNotMatch(viewSrc, /Math\.max\(10000/)
})

