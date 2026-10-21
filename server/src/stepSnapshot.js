/**
 * Step-level worktree snapshots (5.3.0 TRC-01 foundation).
 * Git repos: record HEAD + diff against step start; non-git dirs deferred.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const STEP_PATCH_MAX_BYTES = 120_000

function git(cwd, args, opts = {}) {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    timeout: 15_000,
    maxBuffer: STEP_PATCH_MAX_BYTES + 64_000,
    ...opts,
  })
}

function parseDiffStat(statText) {
  const lines = String(statText || '')
    .trim()
    .split('\n')
    .filter(Boolean)
  let filesChanged = 0
  let insertions = 0
  let deletions = 0
  for (const line of lines) {
    const m = line.trim().match(
      /^(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?$/,
    )
    if (m) {
      filesChanged = Number(m[1]) || 0
      insertions = Number(m[2]) || 0
      deletions = Number(m[3]) || 0
      break
    }
  }
  return { filesChanged, insertions, deletions, stat: statText.trim() }
}

function countUntrackedFiles(cwd) {
  const out = git(cwd, ['ls-files', '--others', '--exclude-standard']).trim()
  if (!out) return 0
  return out.split('\n').filter(Boolean).length
}

/** Lightweight marker at node start (git HEAD only). */
export function captureStepSnapshot(workDir) {
  const cwd = path.resolve(String(workDir || '').trim())
  if (!cwd || !fs.existsSync(cwd)) {
    return { mode: 'none', reason: 'missing_dir' }
  }
  if (!fs.existsSync(path.join(cwd, '.git'))) {
    return { mode: 'none', reason: 'no_git' }
  }
  try {
    const head = git(cwd, ['rev-parse', 'HEAD']).trim()
    return { mode: 'git', head, capturedAt: new Date().toISOString() }
  } catch (e) {
    return { mode: 'none', reason: 'git_error', error: e?.message || String(e) }
  }
}

/** Diff from step-start HEAD to working tree after the node finishes. */
export function summarizeStepChange(before, workDir) {
  const cwd = path.resolve(String(workDir || '').trim())
  if (!before || before.mode !== 'git' || !cwd || !fs.existsSync(cwd)) {
    return { mode: 'none', reason: before?.reason || 'no_git' }
  }
  try {
    const statText = git(cwd, ['diff', '--stat', before.head]).trim()
    let { filesChanged, insertions, deletions, stat } = parseDiffStat(statText)
    const untracked = countUntrackedFiles(cwd)
    if (untracked > 0) {
      filesChanged += untracked
      stat = [stat, `${untracked} untracked file(s)`].filter(Boolean).join('\n')
    }
    let patch = ''
    let patchTruncated = false
    if (filesChanged > 0) {
      patch = git(cwd, ['diff', before.head])
      const untrackedList = git(cwd, ['ls-files', '--others', '--exclude-standard']).trim()
      if (untrackedList) {
        for (const rel of untrackedList.split('\n').filter(Boolean)) {
          try {
            const abs = path.join(cwd, rel)
            const body = fs.readFileSync(abs, 'utf8')
            patch += `\n\n--- /dev/null\n+++ b/${rel}\n${body
              .split('\n')
              .map((l) => `+${l}`)
              .join('\n')}\n`
          } catch {
            patch += `\n\n(untracked ${rel})\n`
          }
        }
      }
      if (patch.length > STEP_PATCH_MAX_BYTES) {
        patch = patch.slice(0, STEP_PATCH_MAX_BYTES)
        patchTruncated = true
      }
    }
    const afterHead = git(cwd, ['rev-parse', 'HEAD']).trim()
    return {
      mode: 'git',
      fromHead: before.head,
      toHead: afterHead,
      filesChanged,
      insertions,
      deletions,
      stat,
      patch,
      patchTruncated,
      capturedAt: new Date().toISOString(),
    }
  } catch (e) {
    return { mode: 'none', reason: 'git_error', error: e?.message || String(e) }
  }
}

import { formatStepChangeSummary } from '@acw/shared'

export const formatChangeSummary = formatStepChangeSummary
