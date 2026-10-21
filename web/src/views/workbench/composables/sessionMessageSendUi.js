/** Plain message send result routing (FE-01 pure logic). */

export function messageSendOpensNewSession(result) {
  return Boolean(result?.newSession && result?.session?.id)
}

export function messageSendNewSessionId(result) {
  return messageSendOpensNewSession(result) ? result.session.id : null
}

export function shouldRefreshCurrentSessionAfterSend(result) {
  return !messageSendOpensNewSession(result)
}

export function messageSendMentionFeedback(result) {
  if (!result?.mentionPending) return null
  return {
    offsiteMode: result.offsiteMode,
    mainGateWaiting: Boolean(result.mainGateWaiting),
  }
}
