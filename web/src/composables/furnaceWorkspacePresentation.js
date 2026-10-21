/** Furnace workspace copy and mood (FE-01 pure helpers). */

import { t } from '../i18n/index.js'

export function furnaceQuickChips() {
  return [
    t('furnace.chips.current'),
    t('furnace.chips.missing'),
    t('furnace.chips.gate'),
  ]
}

export function furnaceFailHint(terminal, agentKind) {
  const err = String(terminal?.lastError || terminal?.error?.message || '').trim()
  if (err) return err
  if (terminal?.status === 'failed') {
    const cmd = agentKind === 'cursor' ? 'cursor-agent' : 'grok'
    return t('furnace.fail.cliNotRunning').replace('{cmd}', cmd)
  }
  if (terminal?.exitCode != null && Number(terminal.exitCode) !== 0) {
    return t('furnace.fail.exitCode').replace('{code}', String(terminal.exitCode))
  }
  return t('furnace.fail.stopped')
}

export function furnaceBuddyMood(terminalStatus, connectionStatus) {
  const st = String(terminalStatus || '')
  if (st === 'running') return 'working'
  if (st === 'starting' || connectionStatus === 'connecting') return 'idle'
  if (['exited', 'failed', 'killed'].includes(st) || connectionStatus !== 'open') {
    return 'waiting'
  }
  return 'idle'
}

export function furnaceFooterHint({
  isRunning,
  surface,
  isPagefill,
  focused,
}) {
  if (!isRunning) return t('furnace.footer.stopped')
  if (surface === 'chat') {
    return isPagefill ? t('furnace.footer.chatPagefill') : t('furnace.footer.chatInline')
  }
  if (focused) return t('furnace.footer.tuiFocused')
  if (isPagefill) return t('furnace.footer.tuiPagefillEsc')
  return t('furnace.footer.tuiIdle')
}
