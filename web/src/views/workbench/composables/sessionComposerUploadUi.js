/** Composer file upload toasts (DSK-08). */

import { t } from '../../../i18n/index.js'

export function composerUploadNeedSessionMessage() {
  return t('workbench.composer.uploadNeedSession')
}

export function composerUploadNoTargetAddMessage() {
  return t('workbench.composer.uploadNoSession')
}

export function composerUploadSuccessMessage(count) {
  return t('workbench.composer.uploadAdded').replace('{count}', String(count))
}
