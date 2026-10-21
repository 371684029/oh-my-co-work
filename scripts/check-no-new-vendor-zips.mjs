#!/usr/bin/env node
/**
 * REPO-01 guard: runtime zips belong on GitHub Release, not in git (except legacy tracked files).
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packagesDir = path.join(root, 'packages')

let staged = ''
try {
  staged = execFileSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' })
} catch {
  process.exit(0)
}

const bad = staged
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l.startsWith('packages/') && l.endsWith('.zip'))

if (bad.length) {
  console.error('REPO-01: do not commit new packages/*.zip — publish to GitHub Release instead:')
  for (const f of bad) console.error(`  ${f}`)
  process.exit(1)
}

if (!fs.existsSync(packagesDir)) process.exit(0)
console.log('check-no-new-vendor-zips: OK (no staged zip under packages/)')
