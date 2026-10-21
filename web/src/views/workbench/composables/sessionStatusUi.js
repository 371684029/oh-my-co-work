import { nodeStatusLabel } from '@acw/shared'

export function sessionStatusLabel(s) {
  if (s === 'pending' || s === 'not_run') return '待跑'
  if (s === 'waiting_human') return '待确认'
  const m = {
    active: '进行中',
    interrupted: '待恢复',
    archived: '已归档',
    failed: '失败',
    paused: '暂停',
    running: '执行中',
    succeeded: '完成',
    skipped: '已绕过',
  }
  return m[s] || nodeStatusLabel(s) || s
}

export function sessionStatusType(s) {
  if (s === 'archived') return 'info'
  if (s === 'waiting_human') return 'danger'
  if (s === 'interrupted') return 'warning'
  if (s === 'failed') return 'danger'
  return 'success'
}
