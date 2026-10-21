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

export function furnaceBackToChatTitle() {
  return t('furnace.chrome.backToChatTitle')
}

export function furnaceAgentGrokTitle() {
  return t('furnace.chrome.agentGrokTitle')
}

export function furnaceAgentCursorTitle() {
  return t('furnace.chrome.agentCursorTitle')
}

export function furnaceGuiModeTitle() {
  return t('furnace.chrome.guiModeTitle')
}

export function furnaceTuiModeTitle() {
  return t('furnace.chrome.tuiModeTitle')
}

export function furnacePagefillTitle(isPagefill) {
  return isPagefill ? t('furnace.chrome.pagefillExitTitle') : t('furnace.chrome.pagefillEnterTitle')
}

export function furnaceBrowserFullscreenTitle(isFullscreen) {
  return isFullscreen
    ? t('furnace.chrome.browserFullscreenExit')
    : t('furnace.chrome.browserFullscreenEnter')
}

export function furnaceProcessMenuTitle() {
  return t('furnace.chrome.processMenuTitle')
}

export function furnaceTurnCopyTitle() {
  return t('furnace.chrome.turnCopyTitle')
}

export function furnaceTurnTimeTitle() {
  return t('furnace.chrome.turnTimeTitle')
}

export function furnaceTurnThinkingTitle() {
  return t('furnace.chrome.turnThinkingTitle')
}

export function furnaceTurnDurationTitle() {
  return t('furnace.chrome.turnDurationTitle')
}

export function furnaceInputTipsTitle() {
  return t('furnace.compose.tipsTitle')
}

export function furnaceInputTipsDescription() {
  return t('furnace.compose.tipsDescription')
}

export function furnaceChatPlaceholder() {
  return t('furnace.compose.placeholder')
}

export function furnaceRemovePendingTitle() {
  return t('furnace.compose.removePending')
}

export function furnaceAttachmentTitle() {
  return t('furnace.compose.attachmentTitle')
}

export function furnaceAttachmentButtonLabel(uploading) {
  return uploading ? t('furnace.compose.uploading') : t('furnace.compose.attachment')
}

export function furnaceComposeBarHint() {
  return t('furnace.compose.barHint')
}

export function furnaceSendLabel() {
  return t('furnace.compose.send')
}

export function furnaceTuiHistoryTitle(open) {
  return open ? t('furnace.tuiDrawer.collapseHistory') : t('furnace.tuiDrawer.expandHistory')
}

export function furnaceTuiDrawerHead() {
  return t('furnace.tuiDrawer.head')
}

export function furnaceTuiDrawerEmpty() {
  return t('furnace.tuiDrawer.empty')
}

export function furnaceTuiCopyTurnLabel() {
  return t('furnace.tuiDrawer.copyTurn')
}

export function furnaceStatusBarLine(isPagefill, surface) {
  const layout = isPagefill ? t('furnace.chrome.layoutPagefill') : t('furnace.chrome.layoutInline')
  const mode = surface === 'chat' ? t('furnace.gui') : t('furnace.tui')
  return t('furnace.chrome.statusBar').replace('{layout}', layout).replace('{mode}', mode)
}
