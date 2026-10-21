/** Composer @-assist detection (FE-01 pure logic). */
import { isMentionAssistOnly } from '@acw/shared'

export function composerMentionAssistOnly(text, members) {
  if (!String(text || '').trim()) return false
  return isMentionAssistOnly(
    text,
    (members || []).map((m) => ({
      display_name: m.display_name,
      name: m.name,
    })),
  )
}
