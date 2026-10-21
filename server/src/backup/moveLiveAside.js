import fs from 'node:fs'
import path from 'node:path'
import { cp, mkdir, rm } from 'node:fs/promises'

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
