#!/usr/bin/env node
/** RFN-T02 冒烟：炼化计划 + verify 预览（不落库）。 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-selftest-refine-'))
process.env.ACW_DATA_ROOT = dataRoot

const { initDb } = await import(path.join(root, 'server/src/db.js'))
initDb()

const { planRefineOnMemberSave } = await import(path.join(root, 'server/src/refineSource.js'))
const { previewRefineVerify } = await import(path.join(root, 'server/src/memberVerify.js'))
const { MEMBER_KIND } = await import(path.join(root, 'shared/index.js'))

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-refine-probe-'))
const js = path.join(dir, 'probe.mjs')
fs.writeFileSync(js, 'console.log("### 炼化探针\\n\\nhi")\n', 'utf8')
const member = {
  id: 'm_smoke',
  kind: MEMBER_KIND.SCRIPT,
  display_name: '炼化探针',
  config: {
    refine: { enabled: true, format: { title: '炼化探针' } },
    script: { mode: 'file', filePath: js, scriptWorkDir: dir, executionMode: 'pipe' },
  },
}

const plan = planRefineOnMemberSave(member)
const preview = previewRefineVerify(member)
if (!plan.files?.length && plan.reason !== 'already') {
  console.error('[selftest-refine-smoke] unexpected plan', plan.reason)
  process.exit(1)
}
if (!preview.checks?.length) {
  console.error('[selftest-refine-smoke] no verify preview checks')
  process.exit(1)
}
console.log('[selftest-refine-smoke] ok plan=%s preview=%s', plan.reason, preview.simulated ? 'simulated' : 'live')