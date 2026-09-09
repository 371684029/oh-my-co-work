import assert from 'node:assert/strict'
import test from 'node:test'

// 4.5 熔炉炼化：决策与格式化逻辑（纯函数，无需 grok/会话）。
import {
  extractMessageText,
  applyRefineFormat,
  defaultRefineFormat,
  refineOutputForNode,
} from '../src/refine.js'

const member = (refine) => ({ id: 'm1', name: 'm1', display_name: '日志员', config: { refine } })

test('extractMessageText：支持 summary / text / data / 字符串', () => {
  assert.equal(extractMessageText({ summary: '产出A' }), '产出A')
  assert.equal(extractMessageText({ text: '产出B' }), '产出B')
  assert.equal(extractMessageText({ data: '产出C' }), '产出C')
  assert.equal(extractMessageText('产出D'), '产出D')
  assert.equal(extractMessageText({ choices: [{ text: 'AI文本' }] }), 'AI文本')
  assert.equal(extractMessageText(null), '')
})

test('applyRefineFormat：有 title 包裹 + 去 ANSI；无 title 保原样去 ANSI', () => {
  const ansi = '\u001b[31m红\u001b[0m'
  assert.equal(applyRefineFormat(ansi, { title: '日报' }), '### 日报\n\n红')
  assert.equal(applyRefineFormat(ansi, null), '红')
  assert.equal(applyRefineFormat('', { title: '日报' }), '')
})

test('defaultRefineFormat：`### 成员 产出` 兜底', () => {
  assert.equal(defaultRefineFormat('一些内容', { display_name: '日志员' }), '### 日志员 产出\n\n一些内容')
  assert.equal(defaultRefineFormat('', { display_name: '日志员' }), '')
})

test('refineOutputForNode：已炼化（有规格）→ source spec', () => {
  const m = member({ enabled: true, format: { title: '成员台账' } })
  const r = refineOutputForNode('正文', m)
  assert.equal(r.source, 'spec')
  assert.equal(r.refined, true)
  assert.equal(r.fallback, false)
  assert.equal(r.formatted, '### 成员台账\n\n正文')
})

test('refineOutputForNode：未炼化但 step 勾选炼化（forceRefine）→ source formatter（格式化节点）', () => {
  const m = member({ enabled: false })
  const r = refineOutputForNode('正文', m, { forceRefine: true })
  assert.equal(r.source, 'formatter')
  assert.equal(r.fallback, true)
  assert.equal(r.formatted, '### 日志员 产出\n\n正文')
})

test('refineOutputForNode：未开启炼化 → source none（原样）', () => {
  const m = member(null)
  const r = refineOutputForNode('正文', m)
  assert.equal(r.source, 'none')
  assert.equal(r.formatted, '正文')
})

test('refineOutputForNode：自定义 formatter 注入（测试替身）', () => {
  const m = member({ enabled: true })
  const custom = (output) => `FORMAT:${output}`
  const r = refineOutputForNode('x', m, { forceRefine: true, formatter: custom })
  assert.equal(r.formatted, 'FORMAT:x')
  assert.equal(r.source, 'formatter')
})
