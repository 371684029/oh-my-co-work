/** Gate action toast messages (DSK-08 via t()). */

import { t } from '../../../i18n/index.js'

/** @returns {{ level: 'success' | 'info', message: string } | null} */
export function gateActionToast(action, hasText) {
  const text = !!String(hasText || '').trim()
  switch (action) {
    case 'approve_start':
      return { level: 'success', message: t('workbench.gate.approveStart') }
    case 'cancel_start':
      return { level: 'info', message: t('workbench.gate.cancelStart') }
    case 'resume_interrupted':
      return { level: 'success', message: t('workbench.gate.resumeInterrupted') }
    case 'discard_interrupted':
    case 'archive_interrupted':
      return { level: 'info', message: t('workbench.gate.discardInterrupted') }
    case 'approve':
    case 'admin_approve':
      return {
        level: 'success',
        message: text ? t('workbench.gate.approveWithNote') : t('workbench.gate.approve'),
      }
    case 'reject':
    case 'admin_reject':
      return {
        level: 'info',
        message: text ? t('workbench.gate.rejectWithNote') : t('workbench.gate.reject'),
      }
    default:
      return null
  }
}
