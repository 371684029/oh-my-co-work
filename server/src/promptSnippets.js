/**
 * Named prompt / role fragments (5.3.0 REU-04).
 */
import { uid, nowIso } from '@acw/shared'

const SNIPPET_REF = /\{\{snippet:([^}]+)\}\}/gi

export function normalizePromptSnippets(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((s) => s && (s.id || s.name))
    .map((s) => ({
      id: String(s.id || uid('psn')).slice(0, 64),
      name: String(s.name || s.id || '片段').slice(0, 120),
      body: String(s.body || '').slice(0, 32_000),
      updatedAt: s.updatedAt || nowIso(),
    }))
}

export function snippetsByKey(snippets) {
  const map = new Map()
  for (const s of snippets || []) {
    map.set(s.id, s)
    if (s.name) map.set(String(s.name).toLowerCase(), s)
  }
  return map
}

/** Replace `{{snippet:id-or-name}}` in text. */
export function resolvePromptSnippetRefs(text, snippets) {
  if (text == null || text === '') return text
  const str = String(text)
  const map = snippetsByKey(snippets)
  return str.replace(SNIPPET_REF, (_m, key) => {
    const k = String(key || '').trim()
    if (!k) return ''
    const hit = map.get(k) || map.get(k.toLowerCase())
    return hit?.body ?? `{{snippet:${k}}}`
  })
}

/** Prepend bodies for member.config.promptSnippetIds (in order). */
export function composeMemberPrompt(baseText, memberConfig, snippets) {
  const ids = Array.isArray(memberConfig?.promptSnippetIds)
    ? memberConfig.promptSnippetIds
    : []
  const map = snippetsByKey(snippets)
  const parts = []
  for (const id of ids) {
    const s = map.get(id) || map.get(String(id).toLowerCase())
    if (s?.body) parts.push(s.body.trim())
  }
  const merged = [...parts, baseText != null ? String(baseText) : ''].filter(Boolean).join('\n\n')
  return resolvePromptSnippetRefs(merged, snippets)
}
