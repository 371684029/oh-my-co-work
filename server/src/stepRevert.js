/**
 * Revert git worktree to step-start HEAD (5.3.0 TRC-02).
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { summarizeStepChange } from './stepSnapshot.js'

function git(cwd, args) {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 8_000_000,
  })
}

function fingerprint(change) {
  if (!change || change.mode !== 'git') return ''
  return [
    change.filesChanged || 0,
    change.insertions || 0,
    change.deletions || 0,
    String(change.stat || '').trim(),
    String(change.patch || '').slice(0, 4000),
  ].join('\0')
}

export function resolveWorkDirFromNode(node, group) {
  const input = node?.input || {}
  const fromInput = input.workFolder || input.groupFolder || ''
  const fromGroup = group?.work_folder || group?.workFolder || ''
  const raw = String(fromInput || fromGroup || '').trim()
  return raw ? path.resolve(raw) : ''
}

/** @returns {{ ok: boolean, code?: string, workDir?: string, stored?: object, current?: object, needsForce?: boolean, message?: string }} */
export function previewStepRevert(changeSnapshot, workDir) {
  const cs = changeSnapshot
  if (!cs || cs.mode !== 'git' || !cs.fromHead) {
    return { ok: false, code: 'NO_SNAPSHOT', message: '该节点没有可回退的 git 快照' }
  }
  const cwd = path.resolve(String(workDir || '').trim())
  if (!cwd || !fs.existsSync(cwd)) {
    return { ok: false, code: 'MISSING_DIR', message: '工作目录不存在' }
  }
  if (!cs.filesChanged) {
    return { ok: false, code: 'NO_CHANGES', message: '本步未记录文件改动' }
  }
  const current = summarizeStepChange({ mode: 'git', head: cs.fromHead }, cwd)
  const needsForce = fingerprint(current) !== fingerprint(cs)
  return {
    ok: true,
    workDir: cwd,
    stored: cs,
    current,
    needsForce,
    message: needsForce
      ? '工作区在步骤完成后又有改动，强制回退会覆盖当前未保存的编辑'
      : '将把工作区还原到本步执行前的 git 状态（含删除本步新增的未跟踪文件）',
  }
}

export function applyStepRevert(changeSnapshot, workDir, { force = false } = {}) {
  const preview = previewStepRevert(changeSnapshot, workDir)
  if (!preview.ok) {
    const err = new Error(preview.message || '无法回退')
    err.code = preview.code
    throw err
  }
  if (preview.needsForce && !force) {
    const err = new Error(preview.message || '存在冲突')
    err.code = 'CONFLICT'
    err.preview = preview
    throw err
  }
  const cwd = preview.workDir
  const fromHead = changeSnapshot.fromHead
  git(cwd, ['reset', '--hard', fromHead])
  git(cwd, ['clean', '-fd'])
  const after = summarizeStepChange({ mode: 'git', head: fromHead }, cwd)
  return {
    ok: true,
    fromHead,
    filesChanged: changeSnapshot.filesChanged,
    after,
  }
}
