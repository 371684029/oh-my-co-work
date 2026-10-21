/** Parse session.context whether stored as object or JSON string. */
export function parseSessionContext(session) {
  const ctx = session?.context || session?.context_json
  if (typeof ctx === 'string') {
    try {
      return JSON.parse(ctx)
    } catch {
      return null
    }
  }
  return ctx || null
}

/** Session project params #1…#N (excludes system #群聊). */
export function extractSessionParamsList(ctx, maxParams = 99) {
  if (!ctx) return []
  if (Array.isArray(ctx.paramsList) && ctx.paramsList.length) {
    return ctx.paramsList.slice(0, maxParams)
  }
  if (ctx.params && typeof ctx.params === 'object') {
    const keys = Object.keys(ctx.params)
      .filter((k) => /^#\d+$/.test(k))
      .map((k) => Number(k.slice(1)))
      .filter((n) => n >= 1 && n <= maxParams)
      .sort((a, b) => a - b)
    if (keys.length) return keys.map((n) => ctx.params[`#${n}`])
  }
  return []
}

export function sessionGroupCardFromContext(ctx) {
  if (!ctx) return ''
  return ctx.groupCard || ctx.params?.['#群聊'] || ctx.params?.['群聊'] || ''
}

export function sessionGroupFolderFromContext(ctx) {
  if (!ctx) return ''
  return (
    ctx.groupFolder ||
    ctx.params?.['#文件夹'] ||
    ctx.params?.['文件夹'] ||
    ctx.primaryWorkFolder ||
    ctx.workFolders?.[0] ||
    ''
  )
}

export function previewHashValue(v) {
  const s = String(v || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) return ''
  return s.length > 48 ? `${s.slice(0, 48)}…` : s
}

/** Collapsed composer footer hint when a gate is active. */
export function footerCollapsedHintForPendingGate(gate) {
  if (!gate) return '输入消息 · 展开'
  const mode = gate.content?.mode
  if (mode === 'session_start') return '确认开始 · 展开'
  if (mode === 'human_input' || mode === 'need_params') return '请输入 · 展开'
  if (mode === 'adapter_question') return '工具提问 · 展开'
  if (mode === 'interrupted') return '崩溃恢复 · 展开'
  if (gate.content?.requireHuman) return '须人工同意 · 展开'
  return '待你处理 · 展开'
}
