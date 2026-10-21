/** Furnace workspace copy and mood (FE-01 pure helpers). */

export const FURNACE_QUICK_CHIPS = [
  '现在做到哪了？只看当前格。',
  '当前格缺什么？',
  '过闸的话只说通过或拒绝，先告诉我卡在哪。',
]

export function furnaceFailHint(terminal, agentKind) {
  const err = String(terminal?.lastError || terminal?.error?.message || '').trim()
  if (err) return err
  if (terminal?.status === 'failed') {
    const cmd = agentKind === 'cursor' ? 'cursor-agent' : 'grok'
    return `本机没有把 ${cmd} 跑起来。常见原因：没装、没进 PATH、或还没登录。`
  }
  if (terminal?.exitCode != null && Number(terminal.exitCode) !== 0) {
    return `进程已退出（exit ${terminal.exitCode}）。`
  }
  return '这轮已经停了，所以没有新画面，也不能往进程里打字。'
}

export function furnaceBuddyMood(terminalStatus, connectionStatus) {
  const st = String(terminalStatus || '')
  if (st === 'running') return 'working'
  if (st === 'starting' || connectionStatus === 'connecting') return 'idle'
  if (['exited', 'failed', 'killed'].includes(st) || connectionStatus !== 'open') {
    return 'waiting'
  }
  return 'idle'
}

export function furnaceFooterHint({
  isRunning,
  surface,
  isPagefill,
  focused,
}) {
  if (!isRunning) return '进程已结束 · 点「新开熔炉」开空对话；返回群聊只关皮'
  if (surface === 'chat') {
    return isPagefill
      ? '对话框可上翻 · 长合同在文件里 · 模型菜单切 TUI 用键盘'
      : '已在三栏中栏 · 可再满屏或全屏'
  }
  if (focused) return 'TUI 输入中 · Esc 退出焦点 · 右侧箭头展开记录 · 菜单用键盘'
  if (isPagefill) return '再按 Esc 缩小回工作台'
  return '点 TUI 继续输入'
}
