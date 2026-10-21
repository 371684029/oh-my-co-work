/** Composer gate action button labels (DSK-08). */

import { t } from '../../../i18n/index.js'

export function gatePassButtonLabel() {
  return t('workbench.gate.pass')
}

export function gateCancelStartLabel() {
  return t('workbench.gate.cancelStartButton')
}

export function gateSubmitButtonLabel() {
  return t('workbench.gate.submit')
}

export function gateRejectButtonLabel() {
  return t('workbench.gate.rejectButton')
}

export function gateResumeInterruptedLabel() {
  return t('workbench.gate.resumeButton')
}

export function gateDiscardInterruptedLabel() {
  return t('workbench.gate.discardButton')
}

export function gateApproveButtonLabel(lastNodeComplete) {
  return lastNodeComplete ? t('workbench.gate.approveAndComplete') : t('workbench.gate.approveButton')
}

export function gateViewDetailsTitle() {
  return t('workbench.gate.viewDetails')
}
