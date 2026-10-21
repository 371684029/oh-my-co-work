import fs from 'node:fs'
import path from 'node:path'
import { cp } from 'node:fs/promises'
import { assertRegularFile, assertTreeNoSymlinks } from './pathSafety.js'

function copyRegularFileSync(src, dest) {
  assertRegularFile(src, src)
  fs.copyFileSync(src, dest)
}

async function copyTreeAsync(src, dst) {
  if (!fs.existsSync(src)) return
  await cp(src, dst, { recursive: true })
}

export function applyStagedToLiveSync(work, dataRoot) {
  assertTreeNoSymlinks(work)
  const stagedDb = path.join(work, 'oh-my-co-work.sqlite')
  copyRegularFileSync(stagedDb, path.join(dataRoot, 'oh-my-co-work.sqlite'))
  for (const suf of ['-wal', '-shm']) {
    if (fs.existsSync(stagedDb + suf)) {
      copyRegularFileSync(stagedDb + suf, path.join(dataRoot, 'oh-my-co-work.sqlite' + suf))
    }
  }
  const stagedJournals = path.join(work, 'journals')
  if (fs.existsSync(stagedJournals)) {
    fs.cpSync(stagedJournals, path.join(dataRoot, 'journals'), { recursive: true })
  }
  const stagedUploads = path.join(work, 'uploads')
  if (fs.existsSync(stagedUploads)) {
    fs.cpSync(stagedUploads, path.join(dataRoot, 'uploads'), { recursive: true })
  }
}

export async function applyStagedToLiveAsync(work, dataRoot) {
  assertTreeNoSymlinks(work)
  const stagedDb = path.join(work, 'oh-my-co-work.sqlite')
  await cp(stagedDb, path.join(dataRoot, 'oh-my-co-work.sqlite'))
  for (const suf of ['-wal', '-shm']) {
    if (fs.existsSync(stagedDb + suf)) {
      await cp(stagedDb + suf, path.join(dataRoot, 'oh-my-co-work.sqlite' + suf))
    }
  }
  const stagedJournals = path.join(work, 'journals')
  if (fs.existsSync(stagedJournals)) {
    await copyTreeAsync(stagedJournals, path.join(dataRoot, 'journals'))
  }
  const stagedUploads = path.join(work, 'uploads')
  if (fs.existsSync(stagedUploads)) {
    await copyTreeAsync(stagedUploads, path.join(dataRoot, 'uploads'))
  }
}
