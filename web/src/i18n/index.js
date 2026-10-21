/**
 * DSK-08: locale switch + unified t() (zh-CN primary, en-US partial).
 */
import { t as tZh } from './zh-CN.js'
import { t as tEn } from './en-US.js'

const LOCALE_KEY = 'acw.locale'

export const LOCALE_OPTIONS = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en-US', label: 'English' },
]

function readStoredLocale() {
  try {
    const v = localStorage.getItem(LOCALE_KEY)
    if (v === 'en-US' || v === 'zh-CN') return v
  } catch {
    /* ignore */
  }
  return 'zh-CN'
}

let activeLocale = readStoredLocale()

export function getLocale() {
  return activeLocale
}

export function setLocale(next) {
  const v = next === 'en-US' ? 'en-US' : 'zh-CN'
  activeLocale = v
  try {
    localStorage.setItem(LOCALE_KEY, v)
  } catch {
    /* ignore */
  }
}

export function t(key) {
  return activeLocale === 'en-US' ? tEn(key) : tZh(key)
}
