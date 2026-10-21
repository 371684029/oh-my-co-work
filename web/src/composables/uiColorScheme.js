/**
 * App color scheme (5.2.0 UI-05): system / light / dark on `<html>`.
 */

export const COLOR_SCHEME_KEY = 'acw.uiColorScheme'

const VALID = new Set(['system', 'light', 'dark'])

export function normalizeColorScheme(v) {
  const s = String(v || 'system').toLowerCase()
  return VALID.has(s) ? s : 'system'
}

export function readStoredColorScheme() {
  try {
    return normalizeColorScheme(localStorage.getItem(COLOR_SCHEME_KEY))
  } catch {
    return 'system'
  }
}

export function writeStoredColorScheme(scheme) {
  const v = normalizeColorScheme(scheme)
  try {
    localStorage.setItem(COLOR_SCHEME_KEY, v)
  } catch {
    /* ignore */
  }
  return v
}

export function resolveEffectiveScheme(preference) {
  const pref = normalizeColorScheme(preference)
  if (pref === 'light' || pref === 'dark') return pref
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyColorScheme(preference) {
  if (typeof document === 'undefined') return 'light'
  const effective = resolveEffectiveScheme(preference)
  const root = document.documentElement
  root.classList.toggle('ecw-theme-dark', effective === 'dark')
  root.dataset.ecwTheme = effective
  return effective
}

/** @returns {() => void} unsubscribe */
export function watchSystemColorScheme(onChange) {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => onChange()
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}
