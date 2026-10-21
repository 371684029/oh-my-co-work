import { formatBusinessIo } from '@acw/shared'

/** FE-01: locale-safe time formatting for session UI. */

export function formatSessionTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return String(iso)
  }
}

/** 流程轨 I/O：业务摘要（用户输入 / 完成概况），不堆 id·路径·命令 */
export function formatSessionIo(val, role = 'auto') {
  try {
    return formatBusinessIo(val, role)
  } catch {
    if (val == null) return '（无）'
    if (typeof val === 'string') return val || '（空）'
    return '（无业务摘要）'
  }
}
