/** 文档阅读偏好（5.2.0 DOC-05） */

export const DOCS_READING_KEY = 'acw.docsReading'

const DEFAULTS = {
  width: 'standard',
  fontScale: 1,
  theme: 'light',
  focus: false,
}

export function readDocsReadingPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(DOCS_READING_KEY) || '{}')
    const width = ['narrow', 'standard', 'wide'].includes(raw.width) ? raw.width : DEFAULTS.width
    const fontScale = [0.9, 1, 1.12, 1.25].includes(Number(raw.fontScale))
      ? Number(raw.fontScale)
      : DEFAULTS.fontScale
    const theme = ['light', 'dark'].includes(raw.theme) ? raw.theme : DEFAULTS.theme
    return { width, fontScale, theme, focus: !!raw.focus }
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeDocsReadingPrefs(prefs) {
  try {
    localStorage.setItem(DOCS_READING_KEY, JSON.stringify(prefs))
  } catch {
    /* privacy mode */
  }
}

export function docsReadingClassNames(prefs) {
  const p = prefs || readDocsReadingPrefs()
  return [
    `docs-read-width-${p.width}`,
    p.theme === 'dark' ? 'docs-read-theme-dark' : '',
    p.focus ? 'docs-read-focus' : '',
  ].filter(Boolean)
}

export function docsReadingStyle(prefs) {
  const p = prefs || readDocsReadingPrefs()
  return { '--docs-font-scale': String(p.fontScale) }
}
