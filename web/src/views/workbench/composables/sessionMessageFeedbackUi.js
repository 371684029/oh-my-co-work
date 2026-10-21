/** Post-send message toasts (DSK-08). */

import { t } from '../../../i18n/index.js'

export function mentionPendingSuccessMessage(offsiteMode) {
  return offsiteMode === 'planned'
    ? t('workbench.message.mentionPlanned')
    : t('workbench.message.mentionOffsite')
}

export function mainGateWaitingInfoMessage() {
  return t('workbench.message.mainGateWaiting')
}

export function needSelectSessionMessage() {
  return t('workbench.message.needSession')
}

export function newTaskCreatedMessage() {
  return t('workbench.message.newTask')
}
