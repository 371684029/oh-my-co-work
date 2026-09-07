import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const layoutCss = fs.readFileSync(path.join(root, 'src/components/terminal/furnaceLayout.css'), 'utf8')
const vueSrc = fs.readFileSync(path.join(root, 'src/components/terminal/FurnaceWorkspace.vue'), 'utf8')
const viewSrc = fs.readFileSync(path.join(root, 'src/components/terminal/TerminalView.vue'), 'utf8')

test('GUI 对话区是独立滚动容器，不靠撑高整页', () => {
  assert.match(layoutCss, /\.furnace-log[\s\S]*flex:\s*1 1 0%/)
  assert.match(layoutCss, /\.furnace-log[\s\S]*overflow-y:\s*scroll/)
  assert.match(layoutCss, /\.furnace-log[\s\S]*min-height:\s*0/)
  assert.match(layoutCss, /\.furnace-chat[\s\S]*overflow:\s*hidden/)
  assert.match(vueSrc, /class="furnace-log"/)
  assert.match(vueSrc, /furnaceLayout\.css/)
  assert.doesNotMatch(vueSrc, /furnace-tui-history/)
})

test('TUI 终端铺满中栏并可滚，不垫一块历史栏', () => {
  assert.match(layoutCss, /\.furnace-tui[\s\S]*flex:\s*1 1 0%/)
  assert.match(layoutCss, /\.furnace-tui \.terminal-view[\s\S]*height:\s*100%/)
  assert.match(vueSrc, /preserve-history/)
  assert.match(viewSrc, /xterm-viewport/)
  assert.match(viewSrc, /overflow-y:\s*scroll/)
  assert.match(viewSrc, /scrollLines/)
})
