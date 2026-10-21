/**
 * I18N-01: user-visible strings (Chinese primary; extend with en-US later).
 */
export const strings = {
  furnace: {
    idle: '闲置',
    working: '工作中',
    waiting: '等人',
    open: '开熔炉',
    peek: '展开',
    minimize: '收起',
  },
  desktop: {
    openDetachedWindow: '在新窗口打开会话',
  },
}

export function t(key) {
  const parts = String(key || '').split('.')
  let cur = strings
  for (const p of parts) {
    cur = cur?.[p]
    if (cur == null) return key
  }
  return typeof cur === 'string' ? cur : key
}
