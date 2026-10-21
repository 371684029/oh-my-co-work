/**
 * Notification preferences (5.4.0 NTF-04); loaded from server app settings.
 */
import { ref } from 'vue'
import { api } from '../api.js'

const defaults = () => ({
  enabled: true,
  levels: { action: true, error: true, done: false },
  sound: true,
  onlyWhenUnfocused: true,
  quietHours: { enabled: false, start: '22:00', end: '07:00' },
  remindIntervalMs: 30_000,
  maxReminders: 3,
})

const prefs = ref(defaults())
let loaded = false

export function notificationPrefsRef() {
  return prefs
}

export async function loadNotificationPrefs(force = false) {
  if (loaded && !force) return prefs.value
  try {
    const s = await api.appSettings.get()
    const n = s?.notifications
    if (n && typeof n === 'object') {
      prefs.value = {
        ...defaults(),
        ...n,
        levels: { ...defaults().levels, ...(n.levels || {}) },
        quietHours: { ...defaults().quietHours, ...(n.quietHours || {}) },
      }
    } else {
      prefs.value = defaults()
    }
  } catch {
    prefs.value = defaults()
  }
  loaded = true
  return prefs.value
}

export function shouldNotifyLevel(level) {
  const p = prefs.value
  if (!p.enabled) return false
  const key = level === 'action' || level === 'error' || level === 'done' ? level : 'action'
  return p.levels?.[key] !== false
}

export async function saveNotificationPrefs(patch) {
  const next = {
    ...prefs.value,
    ...patch,
    levels: { ...prefs.value.levels, ...(patch.levels || {}) },
  }
  prefs.value = next
  await api.appSettings.update({ notifications: next })
  return next
}
