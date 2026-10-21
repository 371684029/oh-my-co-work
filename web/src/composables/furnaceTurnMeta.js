import { parseFurnaceTurnText } from '@acw/shared'

const turnMetaCache = new Map()

/** Cached parseFurnaceTurnText for FurnaceWorkspace (5.2.0 FUR-08). */
export function getFurnaceTurnMeta(text) {
  const key = String(text || '')
  if (turnMetaCache.has(key)) return turnMetaCache.get(key)
  const meta = parseFurnaceTurnText(key)
  if (turnMetaCache.size > 200) turnMetaCache.clear()
  turnMetaCache.set(key, meta)
  return meta
}
