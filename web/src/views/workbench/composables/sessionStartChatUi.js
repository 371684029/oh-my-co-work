/** Start-chat target parsing and toast keys (FE-01 / DSK-08). */

import { t } from '../../../i18n/index.js'

export function parseStartTarget(raw) {
  const s = String(raw || '')
  const kind = s.slice(0, 2)
  const id = s.slice(2)
  if (!id || (kind !== 'g:' && kind !== 'm:')) return null
  return { kind, id }
}

export function startChatSuccessMessage(kind, reused) {
  if (kind === 'm:') {
    return reused ? t('workbench.start.memberReused') : t('workbench.start.memberNew')
  }
  return t('workbench.start.group')
}

export function startChatNeedTargetMessage() {
  return t('workbench.start.needTarget')
}

export function startChatFailedMessage(err) {
  return err?.message || t('workbench.start.failed')
}
