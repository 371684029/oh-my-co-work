/** Pending scroll target after global chat search navigation. */
let pendingMessageId = null

export function setPendingChatScrollMessageId(id) {
  pendingMessageId = id ? String(id) : null
}

export function consumePendingChatScrollMessageId() {
  const id = pendingMessageId
  pendingMessageId = null
  return id
}