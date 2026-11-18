#!/usr/bin/env node
/**
 * 炼化 / 还原契约冒烟：bat 插入 → 剥离 → 再插入（模拟坏 bat 修复）+ memberVerify 探针。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-selftest-refine-'))
const bat = path.join(dir, 'wrap.bat')
fs.writeFileSync(bat, `@echo off\r\nnode index.mjs %*\r\n`, 'utf8')

const { applyRefineContract, repairRefineContractContent } = await import(
  path.join(root, 'server/src/refineSource.js')
)
const { stripRefineContract } = await import(path.join(root, 'server/src/refineRestore.js'))

applyRefineContract(bat, { title: '分支' })
let text = fs.readFileSync(bat, 'utf8')
assert.match(text, /ACW-REFINE/)
assert.doesNotMatch(text, /缺则用/)

const stripped = stripRefineContract(bat)
assert.equal(stripped.ok, true)
text = fs.readFileSync(bat, 'utf8')
assert.doesNotMatch(text, /ACW-REFINE/)
assert.match(text, /node index\.mjs/)

applyRefineContract(bat, { title: '分支' })
fs.writeFileSync(bat, fs.readFileSync(bat, 'utf8').replace('else use', '缺则用'), 'utf8')
const repair = repairRefineContractContent(bat, { title: '分支' })
assert.equal(repair.ok, true)
fs.writeFileSync(bat, repair.next)
text = fs.readFileSync(bat, 'utf8')
assert.doesNotMatch(text, /缺则用/)

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-selftest-verify-'))
process.env.ACW_DATA_ROOT = dataRoot
const { initDb } = await import(path.join(root, 'server/src/db.js'))
initDb()
const { verifyMemberSync } = await import(path.join(root, 'server/src/memberVerify.js'))

const mjs = path.join(dir, 'probe.mjs')
fs.writeFileSync(mjs, 'console.log("### selftest\\n")\n', 'utf8')

const verify = verifyMemberSync({
  kind: 'script',
  display_name: 'selftest',
  config: {
    refine: { enabled: true, format: { output: { heading: 'selftest' } } },
    script: { mode: 'file', filePath: mjs, scriptWorkDir: dir, executionMode: 'pipe' },
  },
})
assert.equal(verify.ok, true, JSON.stringify(verify.checks))

const { formatVerifyFailureBrief, buildMemberRefineVerifyPrompt } = await import(
  path.join(root, 'server/src/refineVerifyPrompt.js'),
)
const failBrief = formatVerifyFailureBrief(null, {
  ok: false,
  checks: [{ id: 'probe_run', ok: false, detail: 'EXIT' }],
})
assert.match(failBrief, /进程非零退出/)
const promptPack = buildMemberRefineVerifyPrompt(
  {
    id: 'mem_self',
    display_name: 'selftest',
    kind: 'script',
    config: {
      refine: {
        enabled: true,
        verifyLast: { ok: false, checks: [{ id: 'probe_run', ok: false, detail: 'EXIT' }] },
      },
      script: { filePath: mjs, scriptWorkDir: dir },
    },
  },
  { target: 'grok' },
)
assert.match(promptPack.prompt, /进程非零退出|EXIT/)

console.log('[selftest-refine-adapt] ok')
