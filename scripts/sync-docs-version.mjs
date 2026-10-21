#!/usr/bin/env node
/**
 * ENG-06: single source version from root package.json into docs/README headline.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const version = pkg.version || '0.0.0'
const readmePath = path.join(root, 'docs/README.md')
let readme = fs.readFileSync(readmePath, 'utf8')
const line = `当前开发线：**v${version}**（见仓库根 \`package.json\`）。`
if (/当前开发线：\*\*v[\d.]+\*\*/.test(readme)) {
  readme = readme.replace(/当前开发线：\*\*v[\d.]+\*\*（见仓库根 `package\.json`）。/, line)
} else {
  readme = `${line}\n\n${readme}`
}
fs.writeFileSync(readmePath, readme, 'utf8')
console.log('Updated docs/README.md for', version)
