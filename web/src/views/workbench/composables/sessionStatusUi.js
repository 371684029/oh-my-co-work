import { nodeStatusLabel } from '@acw/shared'
import { t } from '../../../i18n/index.js'

const STATUS_KEYS = {
  pending: 'pending',
  not_run: 'notRun',
  waiting_human: 'waitingHuman',
  active: 'active',
  interrupted: 'interrupted',
  archived: 'archived',
  failed: 'failed',
  paused: 'paused',
  running: 'running',
  succeeded: 'succeeded',
  skipped: 'skipped',
}

export function sessionStatusLabel(s) {
  const key = STATUS_KEYS[s]
  if (key) return t(`workbench.sessionStatus.${key}`)
  return nodeStatusLabel(s) || s
}

export function sessionStatusType(s) {
  if (s === 'archived') return 'info'
  if (s === 'waiting_human') return 'danger'
  if (s === 'interrupted') return 'warning'
  if (s === 'failed') return 'danger'
  return 'success'
}
