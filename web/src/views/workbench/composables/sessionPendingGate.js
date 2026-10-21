/**
 * Resolve the gate message that should drive the session composer (if any).
 * @param {object} session
 * @param {object[]} messages
 * @param {object[]} nodes
 * @param {(m: object) => boolean} isPendingGate
 */
export function findPendingGateMessage(session, messages, nodes, isPendingGate) {
  if (!session) return null
  if (session.status === 'archived') return null
  const msgs = [...(messages || [])].reverse()
  const curIdx = Number(session.current_step_index)
  const curNode = Number.isFinite(curIdx)
    ? (nodes || []).find((n) => Number(n.step_index) === curIdx)
    : null

  const adapterGate = msgs.find(
    (m) =>
      m.type === 'gate' &&
      m.content?.mode === 'adapter_question' &&
      m.content?.humanAction === 'pending' &&
      !m.content?.answered,
  )
  if (adapterGate) return adapterGate

  const pendingStart = session.context?.pendingStart
  if (pendingStart && session.status !== 'interrupted') {
    const startGate = msgs.find(
      (m) => m.type === 'gate' && m.content?.mode === 'session_start',
    )
    if (startGate) return startGate
  }

  if (session.status === 'interrupted') {
    const ig = msgs.find((m) => m.type === 'gate' && m.content?.mode === 'interrupted')
    if (ig) return ig
  }

  if (curNode?.status === 'waiting_human') {
    const curGate = msgs.find(
      (m) =>
        m.type === 'gate' &&
        m.node_instance_id === curNode.id &&
        isPendingGate(m),
    )
    if (curGate) return curGate
  }

  return (
    msgs.find((m) => {
      if (m.type !== 'gate' || !isPendingGate(m)) return false
      const n = (nodes || []).find((x) => x.id === m.node_instance_id)
      if (!n) return !m.node_instance_id
      if (!Number.isFinite(curIdx)) return true
      return Number(n.step_index) >= curIdx
    }) || null
  )
}
