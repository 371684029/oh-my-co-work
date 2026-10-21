/** Workbench shell visible strings (DSK-08 via t()). */
import { t } from '../../../i18n/index.js'

export function workbenchTitlePlaceholder() {
  return t('workbench.chrome.titlePlaceholder')
}

export function workbenchHumanAttentionPill() {
  return t('workbench.chrome.humanAttention')
}

export function workbenchSearchChatLabel() {
  return t('workbench.chrome.searchChat')
}

export function workbenchSearchChatAria() {
  return t('workbench.chrome.searchChatAria')
}

export function workbenchSearchPlaceholder() {
  return t('workbench.chrome.searchPlaceholder')
}

export function workbenchSearchLoading() {
  return t('workbench.chrome.searchLoading')
}

export function workbenchSearchEmpty() {
  return t('workbench.chrome.searchEmpty')
}

export function workbenchDetachWindowAria() {
  return t('workbench.chrome.detachAria')
}

export function workbenchPinLabel(pinned) {
  return pinned ? t('workbench.chrome.unpin') : t('workbench.chrome.pin')
}

export function workbenchPinAria(pinned) {
  return pinned ? t('workbench.chrome.unpinAria') : t('workbench.chrome.pinAria')
}

export function workbenchDeleteLabel() {
  return t('workbench.chrome.delete')
}

export function workbenchDeleteAria() {
  return t('workbench.chrome.deleteAria')
}

export function workbenchDetachFailedMessage() {
  return t('workbench.chrome.detachFailed')
}

export function workbenchWelcomeSloganPart(key) {
  return t(`workbench.welcome.slogan.${key}`)
}

export function workbenchWelcomeLiving() {
  return t('workbench.welcome.living')
}

export function workbenchWelcomeDemoCta() {
  return t('workbench.welcome.demoCta')
}

export function workbenchWelcomePickGroup() {
  return t('workbench.welcome.pickGroup')
}
