import os from 'node:os'
import path from 'node:path'

/** Default per-user data root (5.3.0 DSK-05). */
export function resolveDefaultAcwDataRoot() {
  const home = os.homedir()
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
    return path.join(appData, 'oh-my-co-work')
  }
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'oh-my-co-work')
  }
  const cfg = process.env.XDG_CONFIG_HOME || path.join(home, '.config')
  return path.join(cfg, 'oh-my-co-work')
}
