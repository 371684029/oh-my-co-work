/** In-session chat search (FE-01 pure logic). */
import { t } from '../../../i18n/index.js'

export const WORKBENCH_CHAT_SEARCH_DEBOUNCE_MS = 200

export function nextChatSearchSeq(currentSeq) {
  return Number(currentSeq || 0) + 1
}

export function shouldApplyChatSearchResponse(responseSeq, latestSeq) {
  return responseSeq === latestSeq
}

export function chatSearchHitSenderLabel(hit) {
  return hit?.memberName || hit?.role || t('workbench.chatSearch.system')
}

export function canRunChatSearch(query) {
  return Boolean(String(query || '').trim())
}

export function scrollChatMessageIntoView(messageId) {
  if (!messageId) return false
  const el = document.querySelector(`[data-msg-id="${CSS.escape(String(messageId))}"]`)
  if (!el) return false
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  return true
}
