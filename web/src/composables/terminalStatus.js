/**
 * Terminal status labels and isRunning (DSK-08 via i18n).
 * Variants: workspace / card / furnace — wording preserved in locale files.
 */
import { t } from '../i18n/index.js'

/** 是否仍在运行：starting / running 视为活跃 */
export function isTerminalRunning(status) {
  return ['starting', 'running'].includes(status)
}

const VARIANT_PREFIX = {
  workspace: 'terminal.status.workspace',
  card: 'terminal.status.card',
  furnace: 'terminal.status.furnace',
}

/**
 * @param {string} status
 * @param {'workspace' | 'card' | 'furnace'} [variant]
 */
export function terminalStatusText(status, variant = 'workspace') {
  const s = String(status || '')
  if (!s) return ''
  const prefix = VARIANT_PREFIX[variant] || VARIANT_PREFIX.workspace
  const key = `${prefix}.${s}`
  const label = t(key)
  return label === key ? s : label
}

export function connectionStatusText(connectionStatus) {
  if (connectionStatus === 'connecting') return t('terminal.connection.connecting')
  return t('terminal.connection.reconnecting')
}
