export function roleLabel(m, members = []) {
  if (m.role === 'user') return '我'
  if (m.type === 'gate') {
    if (m.content?.mode === 'session_start') return '确认开始'
    if (m.content?.mode === 'human_input') return '请输入'
    if (m.content?.mode === 'need_params') return '请输入'
    if (m.content?.mode === 'interrupted') return '崩溃恢复'
    if (m.content?.mode === 'adapter_question') return '工具提问'
    return '待你处理'
  }
  if (m.role === 'system') return '系统'
  if (m.member_id) {
    const mem = members.find((x) => x.id === m.member_id)
    return mem?.display_name || '成员'
  }
  if (m.role === 'assistant' || m.role === 'member') return '成员'
  return m.role || '未知'
}

/** 气泡上展示的发送人简称 */
export function shortSender(m, fullName, members = []) {
  const full = fullName || roleLabel(m, members)
  if (!full) return '?'
  if (full === '我' || full === '系统' || full === '待你处理' || full === '闸门' || full === '成员') return full
  if (full === '请输入' || full === '人工输入') return '输入'
  if (/[\u4e00-\u9fff]/.test(full)) {
    if (full.length <= 4) return full
    return full.slice(0, 2)
  }
  const parts = full.split(/[\s._-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return parts
      .map((p) => p[0])
      .join('')
      .slice(0, 4)
      .toUpperCase()
  }
  return full.length <= 6 ? full : full.slice(0, 4)
}
