/** Composer @/#/ slash picker keyboard navigation (FE-01). */

import { cyclePickerIndex } from './sessionComposerPickerUi.js'

/**
 * Arrow / Enter / Tab / Escape for a single picker list.
 * @returns {boolean} true when the event was handled
 */
export function handleComposerPickerListKeydown(e, {
  listLength,
  index,
  setIndex,
  onPick,
  onClose,
  selectOnTab = true,
  enterRequiresSlashPrefix = false,
  readSenderText,
}) {
  if (e.key === 'Escape') {
    e.preventDefault()
    onClose()
    return true
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!listLength) return true
    setIndex(cyclePickerIndex(index, 1, listLength))
    return true
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (!listLength) return true
    setIndex(cyclePickerIndex(index, -1, listLength))
    return true
  }
  const enterOrTab =
    (e.key === 'Enter' && !e.shiftKey) || (selectOnTab && e.key === 'Tab')
  if (enterOrTab) {
    if (!listLength) return false
    if (enterRequiresSlashPrefix && readSenderText) {
      const t = readSenderText()
      if (!t.startsWith('/')) return false
    }
    e.preventDefault()
    e.stopPropagation()
    onPick()
    return true
  }
  return false
}
