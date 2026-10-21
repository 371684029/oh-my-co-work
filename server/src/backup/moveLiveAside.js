import fs from 'node:fs'
import path from 'node:path'
import { cp, mkdir, readdir, rm } from 'node:fs/promises'

export function moveLiveAsideSync(dataRoot, asideDir, relPaths) {
  fs.mkdirSync(asideDir, { recursive: true })
  for (const rel of relPaths) {
    const src = path.join(dataRoot, rel)
    if (fs.existsSync(src)) {
      fs.cpSync(src, path.join(asideDir, rel), { recursive: true })
      fs.rmSync(src, { recursive: true, force: true })
    }
  }
}

export async function moveLiveAsideAsync(dataRoot, asideDir, relPaths) {
  await mkdir(asideDir, { recursive: true })
  for (const rel of relPaths) {
    const src = path.join(dataRoot, rel)
    if (fs.existsSync(src)) {
      await cp(src, path.join(asideDir, rel), { recursive: true })
      await rm(src, { recursive: true, force: true })
    }
  }
}

/** Roll back live data from a pre-restore aside snapshot (sync restore path). */
export function restoreFromAsideSync(dataRoot, aside, relPaths) {
  for (const rel of relPaths) {
    const live = path.join(dataRoot, rel)
    if (fs.existsSync(live)) fs.rmSync(live, { recursive: true, force: true })
  }
  if (!aside || !fs.existsSync(aside)) return
  for (const name of fs.readdirSync(aside)) {
    fs.cpSync(path.join(aside, name), path.join(dataRoot, name), { recursive: true })
  }
}

/** SRV-01: async rollback for restoreBackupAsync error path. */
export async function restoreFromAsideAsync(dataRoot, aside, relPaths) {
  for (const rel of relPaths) {
    const live = path.join(dataRoot, rel)
    if (fs.existsSync(live)) await rm(live, { recursive: true, force: true })
  }
  if (!aside || !fs.existsSync(aside)) return
  for (const name of await readdir(aside)) {
    await cp(path.join(aside, name), path.join(dataRoot, name), { recursive: true })
  }
}
