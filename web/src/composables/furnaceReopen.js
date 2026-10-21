import { estimateFurnaceContext, formatFurnaceContextHint, inferFurnaceAgent } from '@acw/shared'

/** Pick the live furnace terminal for the given agent (5.2.0 FUR-05). */
export function pickLiveFurnaceTerminal(terminals, { agent, isFurnaceTuiContext, isTerminalRunning }) {
  const furnaceAgent = inferFurnaceAgent({ furnaceAgent: agent })
  return (terminals || []).find(
    (t) =>
      isFurnaceTuiContext(t) &&
      isTerminalRunning(t.status) &&
      inferFurnaceAgent(t) === furnaceAgent,
  )
}

export function buildFurnaceReopenConfirmCopy({ furnaceAgent, estimate }) {
  const agentLabel = furnaceAgent === 'cursor' ? 'Cursor CLI' : 'Grok'
  const contextHint = formatFurnaceContextHint(estimate)
  const lines = [
    `会结束当前 ${agentLabel} 进程，再开一条空对话。工作台会话与群聊记录不会删除。`,
    '',
    contextHint,
    '',
    '默认会把当前熔炉对话归档到文档中心（可在设置里关闭）。',
  ]
  return lines.join('\n')
}

export function estimateFromTerminalReplay(terminal, furnaceAgent) {
  if (!terminal?.replay) return estimateFurnaceContext('', {})
  return estimateFurnaceContext(terminal.replay, {
    cols: terminal.cols,
    rows: terminal.rows,
    profile: furnaceAgent === 'cursor' ? 'cursor' : 'grok',
  })
}
