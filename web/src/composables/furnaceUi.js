import { ref } from 'vue'

/** 顶栏熔炉精灵三态：闲置 / 工作 / 等人 */
export const furnaceSpriteState = ref('idle')
/** null=未知；false=未配好 Grok，精灵保持「等人」且不隐藏 */
export const grokConfigured = ref(null)
export const grokProbe = ref(null)

export function setGrokConfigured(v) {
  grokConfigured.value = v === true
  if (grokConfigured.value === false) furnaceSpriteState.value = 'waiting'
}

export function setFurnaceGrokGate({ optedIn, probe } = {}) {
  grokProbe.value = probe || null
  const ready = !!optedIn && !!probe?.ready
  grokConfigured.value = ready
  if (!ready) furnaceSpriteState.value = 'waiting'
}

export function grokSetupNeeded(probe, optedIn) {
  if (!optedIn) return true
  if (!probe) return true
  return !probe.ready
}

export function syncFurnaceSpriteState({ pendingGate, sessionStatus, terminals, nodes } = {}) {
  if (grokConfigured.value === false) {
    furnaceSpriteState.value = 'waiting'
    return
  }
  const status = String(sessionStatus || '')
  if (
    pendingGate ||
    status === 'waiting_human' ||
    status === 'interrupted'
  ) {
    furnaceSpriteState.value = 'waiting'
    return
  }
  const termBusy = (terminals || []).some((t) => {
    const st = String(t.status || '')
    return st && st !== 'exited' && st !== 'killed'
  })
  const nodeBusy = (nodes || []).some((n) => n.status === 'running')
  if (termBusy || nodeBusy || status === 'running') {
    furnaceSpriteState.value = 'working'
    return
  }
  furnaceSpriteState.value = 'idle'
}
