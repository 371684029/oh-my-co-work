/** Unwrap ref / computed / exposed child ref to a DOM node (FE-01 FurnaceChatComposer bridge). */
export function resolveFurnaceComposerEl(maybeRef) {
  let v = maybeRef
  for (let i = 0; i < 3 && v != null; i++) {
    if (typeof v === 'object' && 'value' in v) v = v.value
    else break
  }
  return v ?? null
}
