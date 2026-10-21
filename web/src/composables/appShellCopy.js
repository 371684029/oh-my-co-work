/** App shell / top bar strings (DSK-08 via t()). */
import { t } from '../i18n/index.js'

export function shellLogoBackWorkbenchTitle() {
  return t('shell.logoBackWorkbench')
}

export function shellDocsHubTitle() {
  return t('shell.docsHubTitle')
}

export function shellBackToWorkbenchLabel() {
  return t('shell.backToWorkbench')
}

export function shellZoomGroupAria() {
  return t('shell.zoomGroupAria')
}

export function shellZoomOutAria() {
  return t('shell.zoomOutAria')
}

export function shellZoomOutTitle() {
  return t('shell.zoomOutTitle')
}

export function shellZoomResetAria() {
  return t('shell.zoomResetAria')
}

export function shellZoomResetTitle() {
  return t('shell.zoomResetTitle')
}

export function shellZoomInAria() {
  return t('shell.zoomInAria')
}

export function shellZoomInTitle() {
  return t('shell.zoomInTitle')
}

export function shellFullscreenTitle(isFullscreen) {
  return isFullscreen ? t('shell.exitFullscreen') : t('shell.fullscreen')
}

export function shellFullscreenLabel(isFullscreen) {
  return shellFullscreenTitle(isFullscreen)
}

export function shellWorkbenchFullscreenTitle(isFullscreen) {
  return isFullscreen ? t('shell.exitWorkbenchFullscreen') : t('shell.workbenchFullscreen')
}

export function shellWorkbenchFullscreenLabel(isFullscreen) {
  return shellWorkbenchFullscreenTitle(isFullscreen)
}

export function shellPrimaryNavAria() {
  return t('shell.primaryNavAria')
}

export function shellNavWorkbench() {
  return t('shell.navWorkbench')
}

export function shellNavDocs() {
  return t('shell.navDocs')
}

export function shellNavDocsTitle() {
  return t('shell.navDocsTitle')
}

export function shellNavSettings() {
  return t('shell.navSettings')
}

export function shellDocsPreviewTitle() {
  return t('shell.docsPreviewTitle')
}

export function shellDocsPreviewEmpty() {
  return t('shell.docsPreviewEmpty')
}

export function shellBrandTagline() {
  return t('shell.brandTagline')
}

export function shellBrandGuardEmphasis() {
  return t('shell.brandGuard')
}
