/** Scroll flow rail to anchor node (FE-01 extract from useSessionDetail). */
import { nextTick } from 'vue'

export function createFlowScrollToAnchor({ getAnchorNodeId, isFlowTabActive, timerRef }) {
  function scrollFlowToAnchor() {
    if (!isFlowTabActive()) return
    const id = getAnchorNodeId()
    if (!id) return
    window.clearTimeout(timerRef.id)
    timerRef.id = window.setTimeout(async () => {
      await nextTick()
      const el = document.querySelector(
        `[data-flow-node-id="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id}"]`,
      )
      if (!el) return
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
    }, 40)
  }

  function clearFlowScrollTimer() {
    window.clearTimeout(timerRef.id)
  }

  return { scrollFlowToAnchor, clearFlowScrollTimer }
}
