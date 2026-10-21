/** Normalize API / gate errors for UI (5.1.0 UX-02). */

export function formatUserFacingError(err, fallback = '操作失败') {
  if (!err) return fallback
  if (typeof err === 'string') return err.trim() || fallback
  const code = err.code || err.status
  const msg = String(err.message || '').trim()
  if (code === 'PARAM_INVALID') return msg || '参数校验未通过，请检查 # 参数'
  if (code === 'NOT_WAITING') return '当前不在等待确认状态'
  if (code === 'PATH_BUSY') return msg || '工作目录被其它会话占用'
  if (msg) return msg
  return fallback
}
