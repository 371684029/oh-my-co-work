/** BubbleList row mapping for workbench chat (FE-01). */

export function shouldHideMessageFromBubbleList(m, isArchiveMessage) {
  if (m?.type === 'gate' && m.content?.mode === 'archive_confirm') return true
  if (isArchiveMessage(m)) return true
  return false
}

export function mapMessageToBubbleItem(m, { messageText, roleLabel, shortSender, isArchiveMessage }) {
  const isUser = m.role === 'user'
  const isSystem = m.role === 'system'
  const isGate = m.type === 'gate'
  const isArchive = isArchiveMessage(m)
  const full = roleLabel(m)
  const short = isArchive ? '系统' : shortSender(m, full)
  const atts = m.content?.attachments || []
  const kind = isUser
    ? 'user'
    : isArchive
      ? 'archive'
      : isSystem
        ? 'system'
        : isGate
          ? 'gate'
          : 'agent'
  return {
    id: m.id,
    content: messageText(m),
    attachments: atts,
    placement: isUser ? 'end' : 'start',
    noStyle: true,
    shape: 'round',
    maxWidth: '78%',
    avatarGap: 12,
    senderFull: full,
    senderShort: short,
    senderInitial: short.slice(0, 1),
    _kind: kind,
    _raw: m,
    _time: m.created_at || '',
  }
}

export function mapTerminalToBubbleItem(terminal) {
  return {
    id: `terminal:${terminal.id}`,
    content: '',
    placement: 'start',
    noStyle: true,
    shape: 'round',
    maxWidth: '90%',
    avatarGap: 12,
    senderFull: terminal.label || '内嵌终端',
    senderShort: '终端',
    senderInitial: 'T',
    _kind: 'terminal',
    terminal,
    _time: terminal.startedAt || '',
  }
}

export function mergeBubbleRowsByTime(messageRows, terminalRows) {
  return [...messageRows, ...terminalRows].sort((a, b) =>
    String(a._time).localeCompare(String(b._time)),
  )
}
