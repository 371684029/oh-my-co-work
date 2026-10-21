/**
 * Install bundled agent skills to a target directory (5.3.0 REU-05).
 */
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, DATA_ROOT } from './db.js'
import { nowIso } from '@acw/shared'

const SKILLS_ROOT = path.join(ROOT, 'skills')

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name)
    const to = path.join(dest, name)
    const st = fs.statSync(from)
    if (st.isDirectory()) copyDirSync(from, to)
    else fs.copyFileSync(from, to)
  }
}

function parseSkillVersion(skillMd) {
  const m = String(skillMd || '').match(/^version:\s*([^\n]+)/im)
  return m ? m[1].trim() : 'unknown'
}

export function listBundledSkills() {
  if (!fs.existsSync(SKILLS_ROOT)) return []
  return fs
    .readdirSync(SKILLS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const id = d.name
      const skillMd = path.join(SKILLS_ROOT, id, 'SKILL.md')
      let version = 'unknown'
      try {
        version = parseSkillVersion(fs.readFileSync(skillMd, 'utf8'))
      } catch {
        /* ignore */
      }
      return { id, version, path: skillMd }
    })
}

export function installSkillPack({ skillId = 'agent-refine-skill', targetDir } = {}) {
  const id = String(skillId || '').trim()
  const src = path.join(SKILLS_ROOT, id)
  if (!fs.existsSync(src)) throw new Error(`技能包不存在: ${id}`)
  const dest = targetDir
    ? path.resolve(String(targetDir))
    : path.join(DATA_ROOT, 'skills', id)
  copyDirSync(src, dest)
  let version = 'unknown'
  try {
    version = parseSkillVersion(fs.readFileSync(path.join(src, 'SKILL.md'), 'utf8'))
  } catch {
    /* ignore */
  }
  const manifest = {
    skillId: id,
    version,
    installedAt: nowIso(),
    dest,
    source: src,
  }
  fs.writeFileSync(path.join(dest, '.acw-skill-install.json'), JSON.stringify(manifest, null, 2), 'utf8')
  return manifest
}
