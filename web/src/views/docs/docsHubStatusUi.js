/** DocsHub session/file status labels (FE-01 pure logic). */

const STATUS_LABELS = {
  active: '进行中',
  running: '执行中',
  waiting_human: '待确认',
  interrupted: '待恢复',
  archived: '已归档',
  failed: '失败',
  paused: '暂停',
}

export function docsSessionStatusLabel(s) {
  return STATUS_LABELS[s] || s || '未知'
}

export function docsSessionStatusClass(s) {
  if (s === 'archived') return 'archived'
  if (s === 'waiting_human' || s === 'failed') return 'waiting'
  if (s === 'interrupted' || s === 'paused') return 'interrupted'
  return 'active'
}

export function docsFileLabel(f) {
  if (f?.kind === 'step') {
    const m = /step-(\d{2})/.exec(f.name || '')
    return m ? `节点台账 · step-${m[1]}` : '节点台账'
  }
  return f?.title || f?.name || ''
}

export function docsKindTag(kind) {
  if (kind === 'announce') return 'primary'
  if (kind === 'step') return 'success'
  return 'info'
}
