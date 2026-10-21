/** Session rail conversation menu command parsing (FE-01). */

export function normalizeMenuCommand(command) {
  if (command == null) return ''
  if (typeof command === 'string' || typeof command === 'number') return String(command)
  if (typeof command === 'object') {
    return String(command.command ?? command.key ?? command.value ?? '')
  }
  return String(command)
}

export function convMenuActionFromCommand(cmd) {
  const c = String(cmd || '').trim()
  if (c === 'pin' || c === '置顶') return 'pin'
  if (c === 'unpin' || c === '取消置顶') return 'unpin'
  if (c === 'delete' || c === '删除') return 'delete'
  if (c === 'rename' || c === '重命名') return 'rename'
  return null
}

export function sessionIdFromConvItem(item) {
  return item?.uniqueKey || item?.id || item?.key || ''
}
