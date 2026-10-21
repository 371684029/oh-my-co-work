/** Pure parsers for / @ # composer triggers (FE-01). */

export function slashPanelStateFromText(text) {
  if (text.startsWith('/')) {
    const body = text.slice(1)
    return {
      slashOpen: true,
      atOpen: false,
      hashOpen: false,
      slashQuery: body.split(/\s/)[0] || '',
    }
  }
  return { slashOpen: false, slashQuery: '' }
}

export function atPanelStateFromText(text) {
  if (text.startsWith('/')) {
    return { atOpen: false, atQuery: '' }
  }
  const m = text.match(/(^|[\s])@([^\s@]*)$/)
  if (m) {
    return {
      atOpen: true,
      slashOpen: false,
      hashOpen: false,
      atQuery: m[2] || '',
    }
  }
  if (!text.endsWith('@')) {
    return { atOpen: false, atQuery: '' }
  }
  return null
}

/**
 * @param {string} text trimmed trailing whitespace
 * @param {{ locked?: boolean }} [opts] skip when hash insert lock active
 */
export function hashPanelStateFromText(text, { locked = false } = {}) {
  if (locked) return null
  if (text.startsWith('/')) {
    return { hashOpen: false, hashQuery: '' }
  }
  const m = text.match(/(?:^|[\s])#([^\s#]*)$/u)
  if (m) {
    return {
      hashOpen: true,
      slashOpen: false,
      atOpen: false,
      hashQuery: m[1] || '',
    }
  }
  if (!/#([^\s#]*)$/u.test(text)) {
    return { hashOpen: false, hashQuery: '' }
  }
  return null
}

/** Merge partial panel patches onto a store-like object (for tests). */
export function applyComposerPanelPatch(store, patch) {
  if (!patch) return
  for (const [key, value] of Object.entries(patch)) {
    store[key] = value
  }
}
