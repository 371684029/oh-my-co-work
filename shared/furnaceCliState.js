/**
 * Infer high-level Cursor/Grok CLI state from PTY tail (5.2.0 FUR-07).
 * @returns {{ kind: string, title: string, hint: string } | null}
 */
export function inferFurnaceCliBanner(replay, { status, exitCode, lastError } = {}) {
  const err = String(lastError || '').trim()
  const st = String(status || '')
  if (st === 'failed' || (Number.isFinite(Number(exitCode)) && Number(exitCode) !== 0)) {
    return {
      kind: 'error',
      title: '进程异常',
      hint: err || (Number.isFinite(Number(exitCode)) ? `退出码 ${exitCode}` : '终端已结束'),
    }
  }
  const tail = String(replay || '').slice(-12_000).toLowerCase()
  if (!tail.trim() && st !== 'running') return null

  if (/rate limit|quota exceeded|429|too many requests|insufficient credits/.test(tail)) {
    return { kind: 'quota', title: '额度或速率受限', hint: '请稍后重试或检查账户配额' }
  }
  if (/econnrefused|enetunreach|network error|timed out|fetch failed|dns/.test(tail)) {
    return { kind: 'network', title: '网络异常', hint: '检查本机网络与代理设置' }
  }
  if (/sign in|log in|login|authentication required|api key|unauthorized|401/.test(tail)) {
    return { kind: 'auth', title: '等待登录', hint: '在 TUI 中完成登录或配置 API Key' }
  }
  if (
    /\(y\/n\)|approve|approval|waiting for you|press enter to continue|confirm\?|需要确认/.test(
      tail,
    )
  ) {
    return { kind: 'approval', title: '等待确认', hint: '请在终端内完成选择或确认' }
  }
  if (/esc to interrupt|waiting for response|thinking|spinner/.test(tail) && st === 'running') {
    return { kind: 'working', title: 'Agent 处理中', hint: '可切到 TUI 查看完整输出' }
  }
  return null
}
