import { ref } from 'vue'

/** 顶栏熔炉精灵三态：闲置 / 工作 / 等人 */
export const furnaceSpriteState = ref('idle')

export function syncFurnaceSpriteState({ pendingGate, sessionStatus, terminals, nodes } = {}) {
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
