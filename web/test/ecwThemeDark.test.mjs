/**
 * 深色主题自测（token + 兼容层冒烟）
 * 手动验收：设置 → 外观「深色」→ 工作台 / 文档中心 / 成员与群模板表格
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const src = path.join(here, '../src')

const styles = fs.readFileSync(path.join(src, 'styles.css'), 'utf8')
const compat = fs.readFileSync(path.join(src, 'styles/ecw-dark-compat.css'), 'utf8')
const mainJs = fs.readFileSync(path.join(src, 'main.js'), 'utf8')

test('main.js loads ecw-dark-compat.css', () => {
  assert.match(mainJs, /ecw-dark-compat\.css/)
})

test('html.ecw-theme-dark defines chrome and chat tokens', () => {
  const darkBlock = styles.slice(styles.indexOf('html.ecw-theme-dark'))
  for (const token of [
    '--ecw-panel-bg',
    '--ecw-chat-main-bg',
    '--ecw-bubble-agent-bg',
    '--ecw-nav-active',
    '--ecw-input-fill-focus',
    '--ecw-composer-shell',
    '--ecw-docs-content-bg',
  ]) {
    assert.match(darkBlock, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('ecw-dark-compat covers nav, tables, poppers, workbench chat', () => {
  assert.match(compat, /\.nav-item\.active/)
  assert.match(compat, /\.el-table/)
  assert.match(compat, /\.el-select-dropdown/)
  assert.match(compat, /\.wb-chat-main/)
  assert.match(compat, /\.bubble-rich/)
})