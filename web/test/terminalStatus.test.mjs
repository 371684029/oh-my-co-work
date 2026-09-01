import assert from 'node:assert/strict'
import test from 'node:test'

// web 纯逻辑测试（3.8.2）：终端状态文案单一来源的契约。
// 三个场景的措辞差异（运行中/交互中、已完成/已结束）是历史行为，必须保持。

const {
  isTerminalRunning,
  terminalStatusText,
  connectionStatusText,
} = await import('../src/composables/terminalStatus.js')

test('isTerminalRunning: only starting/running are active', () => {
  assert.equal(isTerminalRunning('starting'), true)
  assert.equal(isTerminalRunning('running'), true)
  assert.equal(isTerminalRunning('exited'), false)
  assert.equal(isTerminalRunning('failed'), false)
  assert.equal(isTerminalRunning('killed'), false)
  assert.equal(isTerminalRunning(undefined), false)
})

test('workspace variant keeps 交互中/已结束 wording', () => {
  assert.equal(terminalStatusText('starting'), '启动中')
  assert.equal(terminalStatusText('running'), '交互中')
  assert.equal(terminalStatusText('exited'), '已结束')
  assert.equal(terminalStatusText('failed'), '启动失败')
  assert.equal(terminalStatusText('killed'), '已停止')
  assert.equal(terminalStatusText('timed_out'), '已超时')
  assert.equal(terminalStatusText('interrupted'), '已中断')
})

test('card variant keeps 运行中/已完成 wording', () => {
  assert.equal(terminalStatusText('running', 'card'), '运行中')
  assert.equal(terminalStatusText('exited', 'card'), '已完成')
  assert.equal(terminalStatusText('starting', 'card'), '启动中')
})

test('furnace variant has no timed_out/interrupted and falls back to raw status', () => {
  assert.equal(terminalStatusText('running', 'furnace'), '交互中')
  assert.equal(terminalStatusText('killed', 'furnace'), '已停止')
  // FurnaceWorkspace 原表没有这两个键，回退原字符串
  assert.equal(terminalStatusText('timed_out', 'furnace'), 'timed_out')
  assert.equal(terminalStatusText('interrupted', 'furnace'), 'interrupted')
  assert.equal(terminalStatusText('weird-state', 'furnace'), 'weird-state')
})

test('unknown status falls back to the raw value in every variant', () => {
  assert.equal(terminalStatusText('weird-state'), 'weird-state')
  assert.equal(terminalStatusText('weird-state', 'card'), 'weird-state')
  assert.equal(terminalStatusText(''), '')
})

test('connectionStatusText: connecting vs reconnecting', () => {
  assert.equal(connectionStatusText('connecting'), '连接中')
  assert.equal(connectionStatusText('reconnecting'), '重连中')
  assert.equal(connectionStatusText('other'), '重连中')
})
