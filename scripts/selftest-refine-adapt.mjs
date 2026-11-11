#!/usr/bin/env node
/**
 * 炼化 / 还原契约冒烟：bat 插入 → 剥离 → 再插入（模拟坏 bat 修复）。
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

console.log('[selftest-refine-adapt] ok')
