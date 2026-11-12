/** Composer Enter/submit routing (FE-01 pure logic). */

export function pickSlashCommandOnSubmit(text, slashCommands, fallbackCmd) {
  if (!text?.startsWith('/')) return null
  const token = text.slice(1).trim().split(/\s+/)[0] || ''
  const found = (slashCommands || []).find((c) => c.enabled !== false && c.slash === token)
  return found || fallbackCmd || null
}

export function shouldSubmitHumanGate(gate, mentionAssistOnly) {
  if (!gate) return false
  const mode = gate.content?.mode
  if (mode !== 'human_input' && mode !== 'need_params') return false
  return !mentionAssistOnly
}

export function shouldSessionStartGateOnSubmit(gate, mentionAssistOnly) {
  if (!gate || mentionAssistOnly) return false
  return gate.content?.mode === 'session_start'
}

export function canSendPlainMessage(text, attachmentsCount) {
  return Boolean(String(text || '').trim()) || Number(attachmentsCount) > 0
}

/** @returns {'slash'|'session_start_gate'|'human_gate'|'plain_message'|'noop'} */
export function composerSubmitRoute({ text, gate, mentionAssistOnly, attachmentsCount }) {
  const raw = String(text || '')
  if (raw.startsWith('/')) return 'slash'
  if (shouldSessionStartGateOnSubmit(gate, mentionAssistOnly)) return 'session_start_gate'
  if (shouldSubmitHumanGate(gate, mentionAssistOnly)) return 'human_gate'
  if (canSendPlainMessage(raw, attachmentsCount)) return 'plain_message'
  return 'noop'
}
