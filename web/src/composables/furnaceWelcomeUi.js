/** Furnace welcome / buddy copy (DSK-08 / FE-01). */

import { t } from '../i18n/index.js'

export function furnaceWelcomeTitle(agentKind) {
  return agentKind === 'cursor'
    ? t('furnace.welcome.titleCursor')
    : t('furnace.welcome.titleGrok')
}

export function furnaceBuddyLine({ isRunning, showBody, agentKind, agentBrand }) {
  if (!isRunning) return t('furnace.welcome.buddyStopped')
  if (!showBody) {
    return agentKind === 'cursor'
      ? t('furnace.welcome.buddyCursorWaiting')
      : t('furnace.welcome.buddyGrokWaiting')
  }
  return t('furnace.welcome.buddyActive').replace('{brand}', agentBrand)
}

export function furnaceWelcomeKicker({
  connectionStatus,
  terminalStatus,
  isRunning,
  agentBrand,
  agentKind,
}) {
  if (connectionStatus === 'connecting') return t('furnace.welcome.kickerConnecting')
  if (terminalStatus === 'starting') {
    return t('furnace.welcome.kickerStarting').replace('{brand}', agentBrand)
  }
  if (isRunning) {
    return agentKind === 'cursor'
      ? t('furnace.welcome.kickerReadyCursor')
      : t('furnace.welcome.kickerReadyGrok')
  }
  return t('furnace.welcome.kickerNotRunning')
}

export function furnaceFailHeading(agentLabel) {
  return t('furnace.welcome.failHeading').replace('{agent}', agentLabel)
}

export function furnaceFailChipViewTui() {
  return t('furnace.welcome.failChipViewTui')
}

export function furnaceFailChipReopen() {
  return t('furnace.welcome.failChipReopen')
}

export function furnaceFailChipBackToChat() {
  return t('furnace.welcome.failChipBackToChat')
}

export function furnaceWelcomeIntroCursor(agentBrand) {
  return t('furnace.welcome.introCursor').replace('{brand}', agentBrand)
}

export function furnaceWelcomeIntroGrok(agentBrand) {
  return t('furnace.welcome.introGrok').replace('{brand}', agentBrand)
}

export function furnaceWelcomeListItems() {
  return [
    t('furnace.welcome.listProgress'),
    t('furnace.welcome.listAdapt'),
    t('furnace.welcome.listGate'),
    t('furnace.welcome.listInbox'),
  ]
}
