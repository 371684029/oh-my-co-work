import { isDiscardedUnexecutedFlowNode } from '@acw/shared'

export function nodeHasAdapt(n) {
  return !!(n?.input?.adapt || n?.output?.adapt)
}

export function nodeHasRefine(n) {
  return !!n?.input?.refine
}

export function isClonedNode(n) {
  return !!(n?.output?.cloned || n?.input?.cloned)
}

/** Whether `n` is the active step on the flow rail (not offsite). */
export function isCurrentStepNode(n, session) {
  if (!session || !n) return false
  if (n.step_type === 'offsite') return false
  if (session.status === 'archived') return false
  return (
    n.step_index === session.current_step_index &&
    n.status !== 'succeeded' &&
    n.status !== 'skipped'
  )
}

export function isWaitingHumanStep(n, session) {
  if (n.step_type === 'offsite') return n.status === 'waiting_human' || n.status === 'running'
  return n.status === 'waiting_human' || (isCurrentStepNode(n, session) && n.step_type === 'human')
}

/** CSS class for one flow-rail node row. */
export function flowNodeClass(n, session) {
  if (n.step_type === 'offsite') {
    if (n.status === 'running' || n.status === 'waiting_human') return 'offsite-active'
    return 'offsite-idle'
  }
  if (n.step_type === 'archive') {
    if (n.status === 'waiting_human') return 'human-wait'
    if (n.status === 'succeeded') return 'done'
    return 'pending'
  }
  if (n.status === 'succeeded' || n.status === 'skipped') return 'done'
  if (n.status === 'failed') return 'failed'
  if (isWaitingHumanStep(n, session) || n.status === 'waiting_human') return 'human-wait'
  if (n.status === 'running') return 'running'
  if (isCurrentStepNode(n, session)) return 'current'
  if (n.step_type === 'human' || n.gate) return 'human-config'
  return 'pending'
}

export function computeFlowHistorySplitIndex(nodes, session) {
  const list = nodes || []
  if (!list.length) return 0
  const last = session?.context?.lastRestart
  const batch = last?.cloneBatchId
  if (batch) {
    const i = list.findIndex(
      (n) => (n.output?.cloneBatchId || n.input?.cloneBatchId) === batch,
    )
    if (i > 0) return i
  }
  const cur = Number(session?.current_step_index)
  if (!Number.isFinite(cur)) return 0
  const i = list.findIndex((n) => Number(n.step_index) >= cur)
  return i > 0 ? i : 0
}

export function isFlowHistoryNode(n, nodes, splitIndex) {
  const list = nodes || []
  const i = list.findIndex((x) => x.id === n.id)
  return i >= 0 && i < splitIndex
}

export function buildFlowEntries(nodes, session) {
  const entries = []
  for (const node of nodes || []) {
    if (node.step_type === 'archive') continue
    const discarded = isDiscardedUnexecutedFlowNode(node, {
      currentStepIndex: session?.current_step_index,
      isCurrent: isCurrentStepNode(node, session),
    })
    const previous = entries.at(-1)
    if (discarded && previous?.type === 'skipped') {
      previous.nodes.push(node)
      previous.key = `skipped-${previous.nodes[0].id}-${node.id}`
    } else if (discarded) {
      entries.push({ type: 'skipped', key: `skipped-${node.id}-${node.id}`, nodes: [node] })
    } else {
      entries.push({ type: 'node', key: `node-${node.id}`, nodes: [node] })
    }
  }
  return entries
}

/** Pick the node id the flow rail should scroll into view. */
export function pickFlowAnchorNodeId(nodes, session, { activeOffsiteId } = {}) {
  const list = nodes || []
  if (!list.length) return null
  if (activeOffsiteId) return activeOffsiteId
  const archWait = list.find(
    (n) => n.step_type === 'archive' && n.status === 'waiting_human' && isCurrentStepNode(n, session),
  )
  if (archWait) return archWait.id
  const waitingAtCur = list.find(
    (n) =>
      n.status === 'waiting_human' &&
      Number(n.step_index) === Number(session?.current_step_index),
  )
  if (waitingAtCur) return waitingAtCur.id
  const waiting = [...list].reverse().find((n) => n.status === 'waiting_human')
  if (waiting) return waiting.id
  const running = list.find((n) => n.status === 'running')
  if (running) return running.id
  const cur = list.find((n) => isCurrentStepNode(n, session))
  if (cur) return cur.id
  const idx = Number(session?.current_step_index)
  if (Number.isFinite(idx)) {
    const byIdx = list.find((n) => Number(n.step_index) === idx)
    if (byIdx) return byIdx.id
  }
  return list[list.length - 1]?.id || null
}
