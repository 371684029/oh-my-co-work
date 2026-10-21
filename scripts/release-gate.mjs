#!/usr/bin/env node
/**
 * REL-01 / ENG-03: validate release packages + server test smoke.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', ...opts })
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout)
    process.exit(r.status ?? 1)
  }
  return r.stdout
}

run('node', ['scripts/validate-release-packages.mjs'])
run('npm', ['test'], { stdio: 'inherit' })
console.log('release-gate: OK')
