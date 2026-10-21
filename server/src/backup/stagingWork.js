import fs from 'node:fs'
import path from 'node:path'
import { cp } from 'node:fs/promises'

export function copyLiveSqliteSync(liveDb, dbCopy) {
  fs.copyFileSync(liveDb, dbCopy)
  for (const suf of ['-wal', '-shm']) {
    const side = liveDb + suf
    if (fs.existsSync(side) && fs.statSync(side).size > 0) {
      fs.copyFileSync(side, dbCopy + suf)
    }
  }
}

export async function copyLiveSqliteAsync(liveDb, dbCopy) {
  await cp(liveDb, dbCopy)
  for (const suf of ['-wal', '-shm']) {
    const side = liveDb + suf
    if (fs.existsSync(side) && fs.statSync(side).size > 0) {
      await cp(side, dbCopy + suf)
    }
  }
}

export function stageJournalsAndUploadsSync(work, dataRoot, { includeUploads = true } = {}) {
  const journalsSrc = path.join(dataRoot, 'journals')
  const journalsDst = path.join(work, 'journals')
  if (fs.existsSync(journalsSrc)) {
    fs.cpSync(journalsSrc, journalsDst, { recursive: true })
  } else {
    fs.mkdirSync(journalsDst, { recursive: true })
  }
  if (includeUploads !== false) {
    const upSrc = path.join(dataRoot, 'uploads')
    const upDst = path.join(work, 'uploads')
    if (fs.existsSync(upSrc)) {
      fs.cpSync(upSrc, upDst, { recursive: true })
    }
  }
}

export async function stageJournalsAndUploadsAsync(work, dataRoot, { includeUploads = true } = {}) {
  const journalsSrc = path.join(dataRoot, 'journals')
  const journalsDst = path.join(work, 'journals')
  if (fs.existsSync(journalsSrc)) {
    await cp(journalsSrc, journalsDst, { recursive: true })
  } else {
    fs.mkdirSync(journalsDst, { recursive: true })
  }
  if (includeUploads !== false) {
    const upSrc = path.join(dataRoot, 'uploads')
    const upDst = path.join(work, 'uploads')
    if (fs.existsSync(upSrc)) {
      await cp(upSrc, upDst, { recursive: true })
    }
  }
}
