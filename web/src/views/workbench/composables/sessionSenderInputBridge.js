/** XSender read/write bridge (FE-01 extract from useSessionDetail). */
import { nextTick } from 'vue'
import { textToChatNode } from './sessionComposerInput.js'

export function createSessionSenderInputBridge({ senderRef, bumpHashInsertLock }) {
  function readSenderTextRaw() {
    const inst = senderRef.value
    if (!inst) return ''
    try {
      if (typeof inst.getModelValue === 'function') {
        return String(inst.getModelValue()?.text || '')
      }
      const sender = typeof inst.getSender === 'function' ? inst.getSender() : null
      if (sender?.getText) return String(sender.getText() || '')
    } catch {
      /* ignore */
    }
    return ''
  }

  function readSenderText() {
    return readSenderTextRaw().trim()
  }

  async function replaceSenderText(text) {
    const inst = senderRef.value
    if (!inst) return
    const next = text == null ? '' : String(text)
    bumpHashInsertLock?.()
    try {
      const sender = typeof inst.getSender === 'function' ? inst.getSender() : null
      if (sender && typeof sender.reset === 'function') {
        await sender.reset({
          clearHistory: true,
          chatNode: textToChatNode(next),
        })
        return
      }
    } catch {
      /* ignore */
    }
    try {
      if (typeof inst.clear === 'function') inst.clear()
      await nextTick()
      await new Promise((r) => setTimeout(r, 30))
      if (next) inst.setText?.(next)
    } catch {
      /* ignore */
    }
  }

  function appendSenderText(fragment) {
    const s = fragment == null ? '' : String(fragment)
    if (!s) return
    try {
      senderRef.value?.setText?.(s)
    } catch {
      /* ignore */
    }
  }

  function clearSender() {
    const inst = senderRef.value
    if (!inst) return
    try {
      if (typeof inst.clear === 'function') inst.clear()
    } catch {
      /* ignore */
    }
  }

  return { readSenderText, readSenderTextRaw, replaceSenderText, appendSenderText, clearSender }
}
