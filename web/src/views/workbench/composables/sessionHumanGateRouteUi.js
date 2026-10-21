/** Human gate submit routing (FE-01 pure logic). */
import { isMentionAssistOnly } from '@acw/shared'

export function humanGateShouldSendAsMessage(text, members) {
  if (!String(text || '').trim()) return false
  return isMentionAssistOnly(
    text,
    (members || []).map((x) => ({
      display_name: x.display_name,
      name: x.name,
    })),
  )
}
