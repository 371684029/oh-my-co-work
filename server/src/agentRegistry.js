/**
 * Agent adapter registry (5.3.0 EXT-01 foundation).
 */
import { getAppSettings } from './appSettings.js'

const BUILTIN = [
  {
    id: 'grok',
    displayName: 'Grok',
    builtin: true,
    commandKey: 'grok.command',
    pastePolicy: 'confirm',
    structuredAdapter: 'jsonl',
  },
  {
    id: 'cursor',
    displayName: 'Cursor CLI',
    builtin: true,
    commandKey: 'grok.cursorCommand',
    pastePolicy: 'bracketed',
    structuredAdapter: 'jsonl',
  },
]

export function listAgentDefinitions(settings = getAppSettings()) {
  const grok = settings?.grok || {}
  const custom = Array.isArray(settings?.customAgents) ? settings.customAgents : []
  const builtins = BUILTIN.map((def) => ({
    id: def.id,
    displayName: def.displayName,
    builtin: true,
    command:
      def.id === 'cursor'
        ? String(grok.cursorCommand || 'cursor-agent').trim()
        : String(grok.command || 'grok').trim(),
    pastePolicy: def.pastePolicy,
    structuredAdapter: def.structuredAdapter,
  }))
  const extra = custom
    .filter((a) => a && a.id)
    .map((a) => ({
      id: String(a.id),
      displayName: String(a.displayName || a.id),
      builtin: false,
      command: String(a.command || '').trim(),
      pastePolicy: a.pastePolicy || 'confirm',
      structuredAdapter: a.structuredAdapter || null,
    }))
  return [...builtins, ...extra]
}
