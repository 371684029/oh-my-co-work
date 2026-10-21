/** Composer / @ # / slash picker keyboard index (FE-01). */

export function cyclePickerIndex(index, delta, length) {
  if (!length) return index
  return (index + delta + length) % length
}
