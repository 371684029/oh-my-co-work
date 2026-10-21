/**
 * PET-04: centralized furnace sprite visibility policy.
 */
import { furnaceWorkspaceOpen } from './furnaceUi.js'

export function defaultFurnacePetPolicy() {
  return {
    showOnWorkbench: true,
    showOnSettings: false,
    showOnDocs: false,
    hideWhenTerminalFullscreen: true,
  }
}

export function normalizeFurnacePetPolicy(raw) {
  const d = defaultFurnacePetPolicy()
  if (!raw || typeof raw !== 'object') return d
  return {
    showOnWorkbench: raw.showOnWorkbench !== false,
    showOnSettings: raw.showOnSettings === true,
    showOnDocs: raw.showOnDocs === true,
    hideWhenTerminalFullscreen: raw.hideWhenTerminalFullscreen !== false,
  }
}

export function shouldShowFurnacePet({
  routePath = '',
  policy = defaultFurnacePetPolicy(),
  terminalFullscreen = false,
} = {}) {
  if (furnaceWorkspaceOpen.value) return false
  const p = String(routePath || '')
  if (p.startsWith('/docs')) return policy.showOnDocs
  if (p.startsWith('/settings')) return policy.showOnSettings
  if (p.startsWith('/workbench') || p === '/') {
    if (terminalFullscreen && policy.hideWhenTerminalFullscreen) return false
    return policy.showOnWorkbench
  }
  return policy.showOnWorkbench
}
