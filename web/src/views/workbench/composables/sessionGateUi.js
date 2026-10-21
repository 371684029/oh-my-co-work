/** Whether a gate message still blocks the composer (excludes answered / archive confirm). */
export function isPendingGateMessage(m, nodes) {
  if (m?.type !== 'gate') return false
  if (m.content?.mode === 'archive_confirm') return false
  if (m.content?.mode === 'adapter_question') {
    return m.content?.humanAction === 'pending' && !m.content?.answered
  }
  const node = (nodes || []).find((n) => n.id === m.node_instance_id)
  return node?.status === 'waiting_human'
}
