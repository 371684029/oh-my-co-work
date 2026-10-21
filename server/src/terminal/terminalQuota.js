import { inferFurnaceAgent } from '@acw/shared'

export function countRunningTerminals(terminals, sessionId, { exceptMemberId, exceptPair } = {}) {
  return [...terminals.values()].filter((t) => {
    if (t.sessionId !== sessionId) return false
    if (t.status !== 'running' && t.status !== 'starting') return false
    if (exceptPair?.memberId && t.memberId === exceptPair.memberId) {
      if (inferFurnaceAgent(t) === exceptPair.furnaceAgent) return false
    } else if (exceptMemberId && t.memberId === exceptMemberId) {
      return false
    }
    return true
  }).length
}

export function stopMemberTerminals(terminals, sessionId, memberId, { furnaceAgent, killTerminal }) {
  if (!sessionId || !memberId) return
  const onlyAgent = furnaceAgent === 'cursor' || furnaceAgent === 'grok' ? furnaceAgent : null
  for (const entry of [...terminals.values()]) {
    if (entry.sessionId !== sessionId || entry.memberId !== memberId) continue
    if (entry.status !== 'running' && entry.status !== 'starting') continue
    if (onlyAgent && inferFurnaceAgent(entry) !== onlyAgent) continue
    killTerminal(entry.id, 'replaced')
  }
}
