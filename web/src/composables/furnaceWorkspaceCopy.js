/** Furnace workspace chrome labels (DSK-08). */

import { t } from '../i18n/index.js'

export function furnaceBackToChatLabel() {
  return t('furnace.backToChat')
}

export function furnacePagefillLabel(isPagefill) {
  return isPagefill ? t('furnace.exitPagefill') : t('furnace.pagefill')
}

export function furnaceFullscreenLabel(isFullscreen) {
  return isFullscreen ? t('furnace.exitFullscreen') : t('furnace.fullscreen')
}

export function furnaceProcessMenuSummary() {
  return t('furnace.processMenu')
}

export function furnaceReopenLabel() {
  return t('furnace.reopen')
}

export function furnaceCloseFurnaceLabel() {
  return t('furnace.closeFurnace')
}

export function furnaceGuiLabel() {
  return t('furnace.gui')
}

export function furnaceTuiLabel() {
  return t('furnace.tui')
}

export function furnaceTurnCopyEmptyMessage() {
  return t('furnace.turnCopy.empty')
}

export function furnaceTurnCopySuccessMessage() {
  return t('furnace.turnCopy.success')
}

export function furnaceTurnCopyFailedMessage() {
  return t('furnace.turnCopy.failed')
}

export function furnaceRoleYouLabel() {
  return t('furnace.roleYou')
}
