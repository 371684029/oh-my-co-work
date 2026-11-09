/**
 * Step-level worktree snapshots (5.3.0 TRC-01 foundation).
 * Git repos: record HEAD + diff against step start; non-git dirs deferred.
 *
 * Perf fix (5.x): all git calls are async execFile. The old execFileSync ran up
 * to 6 blocking git processes (15s timeout each) on every node boundary,
 * freezing the event loop — furnace TUI, WebSocket and REST all stalled, which
 * was a main cause of the "randomly freezes" reports. Snapshots still complete
 * at node boundaries, just without blocking everything else.
 */
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const STEP_PATCH_MAX_BYTES = 120_000
/** Max bytes of a single untracked file folded into the patch (keeps large binaries out of memory). */
const UNTRACKED_FILE_MAX_BYTES = 64_000

/** Async git; resolves null on any error/timeout so callers can degrade gracefully. */
function runGit(cwd, args) {
  return new Promise((resolve) => {
    execFile(
      'git',
      ['-C', cwd, ...args],
      {
        encoding: 'utf8',
        timeout: 15_000,
        maxBuffer: STEP_PATCH_MAX_BYTES + 64_000,
        windowsHide: true,
      },
      (error, stdout) => resolve(error ? null : String(stdout || '')),
    )
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

/** Lightweight marker at node start (git HEAD only). */
export async function captureStepSnapshot(workDir) {
  const cwd = path.resolve(String(workDir || '').trim())
  if (!cwd || !fs.existsSync(cwd)) {
    return { mode: 'none', reason: 'missing_dir' }
  }
  if (!fs.existsSync(path.join(cwd, '.git'))) {
    return { mode: 'none', reason: 'no_git' }
  }
  const head = await runGit(cwd, ['rev-parse', 'HEAD'])
  if (head == null) {
    return { mode: 'none', reason: 'git_error' }
  }
  return { mode: 'git', head: head.trim(), capturedAt: new Date().toISOString() }
}

/** Diff from step-start HEAD to working tree after the node finishes. */
export async function summarizeStepChange(before, workDir) {
  const cwd = path.resolve(String(workDir || '').trim())
  if (!before || before.mode !== 'git' || !cwd || !fs.existsSync(cwd)) {
    return { mode: 'none', reason: before?.reason || 'no_git' }
  }
  const statText = await runGit(cwd, ['diff', '--stat', before.head])
  if (statText == null) {
    return { mode: 'none', reason: 'git_error' }
  }
  let { filesChanged, insertions, deletions, stat } = parseDiffStat(statText.trim())
  // One ls-files call serves both the count and the patch body
  // (the old implementation ran the same command twice)
  const untrackedListRaw = await runGit(cwd, ['ls-files', '--others', '--exclude-standard'])
  if (untrackedListRaw == null) {
    return { mode: 'none', reason: 'git_error' }
  }
  const untrackedList = untrackedListRaw.trim()
  const untrackedFiles = untrackedList ? untrackedList.split('\n').filter(Boolean) : []
  if (untrackedFiles.length > 0) {
    filesChanged += untrackedFiles.length
    stat = [stat, `${untrackedFiles.length} untracked file(s)`].filter(Boolean).join('\n')
  }
  let patch = ''
  let patchTruncated = false
  if (filesChanged > 0) {
    const diffText = await runGit(cwd, ['diff', before.head])
    if (diffText == null) {
      return { mode: 'none', reason: 'git_error' }
    }
    patch = diffText
    for (const rel of untrackedFiles) {
      try {
        const abs = path.join(cwd, rel)
        const st = fs.statSync(abs)
        if (st.size > UNTRACKED_FILE_MAX_BYTES) {
          patch += `\n\n(untracked ${rel}: ${st.size} bytes, skipped)\n`
          continue
        }
        const body = fs.readFileSync(abs, 'utf8')
        patch += `\n\n--- /dev/null\n+++ b/${rel}\n${body
          .split('\n')
          .map((l) => `+${l}`)
          .join('\n')}\n`
      } catch {
        patch += `\n\n(untracked ${rel})\n`
      }
    }
    if (patch.length > STEP_PATCH_MAX_BYTES) {
      patch = patch.slice(0, STEP_PATCH_MAX_BYTES)
      patchTruncated = true
    }
  }
  const afterHead = await runGit(cwd, ['rev-parse', 'HEAD'])
  if (afterHead == null) {
    return { mode: 'none', reason: 'git_error' }
  }
  return {
    mode: 'git',
    fromHead: before.head,
    toHead: afterHead.trim(),
    filesChanged,
    insertions,
    deletions,
    stat,
    patch,
    patchTruncated,
    capturedAt: new Date().toISOString(),
  }
}

import { formatStepChangeSummary } from '@acw/shared'

export const formatChangeSummary = formatStepChangeSummary
