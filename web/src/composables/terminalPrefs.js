import { onMounted, onUnmounted, ref } from 'vue'

export const TERMINAL_PREFS_KEY = 'acw.terminalPrefs.v1'
export const TERMINAL_PREFS_EVENT = 'acw-terminal-prefs'

export const TERMINAL_THEMES = {
  'project-dark': {
    background: '#17191f',
    foreground: '#e7e9ee',
    cursor: '#67b3ff',
    cursorAccent: '#17191f',
    selectionBackground: '#409eff55',
    black: '#252830',
    red: '#ff6b6b',
    green: '#69db8b',
    yellow: '#ffd166',
    blue: '#64a9ff',
    magenta: '#c792ea',
    cyan: '#5ccfe6',
    white: '#d8dee9',
    brightBlack: '#71798a',
    brightRed: '#ff8787',
    brightGreen: '#8ce99a',
    brightYellow: '#ffe066',
    brightBlue: '#91c4ff',
    brightMagenta: '#d6a6f2',
    brightCyan: '#89e5f3',
    brightWhite: '#ffffff',
  },
  'terminal-default': {
    background: '#0c0c0c',
    foreground: '#cccccc',
    cursor: '#ffffff',
    cursorAccent: '#0c0c0c',
    selectionBackground: '#264f78',
    black: '#0c0c0c',
    red: '#c50f1f',
    green: '#13a10e',
    yellow: '#c19c00',
    blue: '#0037da',
    magenta: '#881798',
    cyan: '#3a96dd',
    white: '#cccccc',
    brightBlack: '#767676',
    brightRed: '#e74856',
    brightGreen: '#16c60c',
    brightYellow: '#f9f1a5',
    brightBlue: '#3b78ff',
    brightMagenta: '#b4009e',
    brightCyan: '#61d6d6',
    brightWhite: '#f2f2f2',
  },
  'high-contrast': {
    background: '#000000',
    foreground: '#ffffff',
    cursor: '#ffff00',
    cursorAccent: '#000000',
    selectionBackground: '#ffffff66',
    black: '#000000',
    red: '#ff0000',
    green: '#00ff00',
    yellow: '#ffff00',
    blue: '#5c9cff',
    magenta: '#ff00ff',
    cyan: '#00ffff',
    white: '#ffffff',
    brightBlack: '#808080',
    brightRed: '#ff6b6b',
    brightGreen: '#7cff7c',
    brightYellow: '#ffff66',
    brightBlue: '#9ec1ff',
    brightMagenta: '#ff9cff',
    brightCyan: '#9cffff',
    brightWhite: '#ffffff',
  },
}

export function defaultTerminalPrefs() {
  return {
    theme: 'project-dark',
    fontSize: 13,
    lineHeight: 1.3,
    fontFamily: 'default',
    cursorStyle: 'bar',
    cursorBlink: true,
    pastePolicy: 'confirm',
    collapseOnExit: false,
    scrollback: 5000,
  }
}

export function normalizeTerminalPrefs(raw = {}) {
  const d = defaultTerminalPrefs()
  const src = raw && typeof raw === 'object' ? raw : {}
  const theme = TERMINAL_THEMES[src.theme] ? src.theme : d.theme
  const fontSize = Math.max(11, Math.min(20, Math.round(Number(src.fontSize) || d.fontSize)))
  const lineHeight = Math.max(1.1, Math.min(1.8, Number(src.lineHeight) || d.lineHeight))
  const fontFamily = src.fontFamily === 'system' ? 'system' : 'default'
  const cursorStyle = ['bar', 'block', 'underline'].includes(src.cursorStyle)
    ? src.cursorStyle
    : d.cursorStyle
  const pastePolicy = ['confirm', 'allow', 'reject'].includes(src.pastePolicy)
    ? src.pastePolicy
    : d.pastePolicy
  const scrollback = Math.max(500, Math.min(20000, Math.round(Number(src.scrollback) || d.scrollback)))
  return {
    theme,
    fontSize,
    lineHeight: Math.round(lineHeight * 10) / 10,
    fontFamily,
    cursorStyle,
    cursorBlink: src.cursorBlink !== false,
    pastePolicy,
    collapseOnExit: src.collapseOnExit === true,
    scrollback,
  }
}

export function loadTerminalPrefs() {
  if (typeof localStorage === 'undefined') return defaultTerminalPrefs()
  try {
    return normalizeTerminalPrefs(JSON.parse(localStorage.getItem(TERMINAL_PREFS_KEY) || '{}'))
  } catch {
    return defaultTerminalPrefs()
  }
}

export function saveTerminalPrefs(patch = {}) {
  const next = normalizeTerminalPrefs({ ...loadTerminalPrefs(), ...patch })
  localStorage.setItem(TERMINAL_PREFS_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event(TERMINAL_PREFS_EVENT))
  return next
}

export function fontFamilyFromPrefs(prefs) {
  if (prefs?.fontFamily === 'system') {
    return 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  }
  return "'Cascadia Code', 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace"
}

export function themeFromPrefs(prefs) {
  return TERMINAL_THEMES[prefs?.theme] || TERMINAL_THEMES['project-dark']
}

export function useTerminalPrefs() {
  const prefs = ref(loadTerminalPrefs())

  function refresh() {
    prefs.value = loadTerminalPrefs()
  }

  function save(patch) {
    prefs.value = saveTerminalPrefs(patch)
    return prefs.value
  }

  onMounted(() => {
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener(TERMINAL_PREFS_EVENT, refresh)
  })
  onUnmounted(() => {
    window.removeEventListener('storage', refresh)
    window.removeEventListener(TERMINAL_PREFS_EVENT, refresh)
  })

  return { prefs, save, refresh }
}
