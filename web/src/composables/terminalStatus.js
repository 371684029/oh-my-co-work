/**
 * 终端状态 → 文案 与 isRunning 的单一来源。
 * TerminalWorkspace / TerminalSessionCard / FurnaceWorkspace 各自场景措辞略有差异，
 * 用 variant 覆盖（workspace / card / furnace），行为保持不变。
 */

/** 是否仍在运行：starting / running 视为活跃 */
export function isTerminalRunning(status) {
  return ['starting', 'running'].includes(status)
}

/** 工作台终端工作区（TerminalWorkspace / TerminalView）的状态文案 */
const WORKSPACE_TEXT = {
  starting: '启动中',
  running: '交互中',
  exited: '已结束',
  failed: '启动失败',
  killed: '已停止',
  timed_out: '已超时',
  interrupted: '已中断',
}

/** 终端卡片（TerminalSessionCard）用「运行中 / 已完成」的措辞 */
const CARD_TEXT = {
  starting: '启动中',
  running: '运行中',
  exited: '已完成',
  failed: '启动失败',
  killed: '已停止',
  timed_out: '已超时',
  interrupted: '已中断',
}

/** 熔炉工作区（FurnaceWorkspace）只覆盖到 killed，其余回退原值 */
const FURNACE_TEXT = {
  starting: '启动中',
  running: '交互中',
  exited: '已结束',
  failed: '启动失败',
  killed: '已停止',
}

/**
 * 终端状态文案。variant: 'workspace' | 'card' | 'furnace'。
 * 未命中时回退原始状态字符串（与原有 `map[s] || s` 行为一致）。
 */
export function terminalStatusText(status, variant = 'workspace') {
  const map =
    variant === 'card' ? CARD_TEXT : variant === 'furnace' ? FURNACE_TEXT : WORKSPACE_TEXT
  return map[status] || status
}

/** 连接状态文案（connectionStatus !== 'open' 时的前缀） */
export function connectionStatusText(connectionStatus) {
  return connectionStatus === 'connecting' ? '连接中' : '重连中'
}
