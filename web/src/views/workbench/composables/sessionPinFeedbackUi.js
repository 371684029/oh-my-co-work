/** Session pin toasts (DSK-08). */

import { t } from '../../../i18n/index.js'

export function sessionPinSuccessMessage(pinned) {
  return pinned ? t('workbench.pin.pinned') : t('workbench.pin.unpinned')
}

export function sessionPinFailedMessage(err) {
  return err?.message || t('workbench.pin.failed')
}
