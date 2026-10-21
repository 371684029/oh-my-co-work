#!/usr/bin/env node
/**
 * ENG-02: record lightweight perf samples and compare to committed baseline.
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const baselinePath = path.join(root, 'server/test/fixtures/perf-baseline.json')
const scriptPath = fileURLToPath(import.meta.url)

const THRESHOLD_RATIO = 2.5

/** Fresh Node process so ACW_DATA_ROOT is read before db.js loads. */
function sampleDbInitMsInChild() {
  const dataRoot = fs.mkdtempSync(path.join(root, 'server/test/fixtures/.perf-'))
  const r = spawnSync(process.execPath, [scriptPath, '--sample'], {
    env: { ...process.env, ACW_DATA_ROOT: dataRoot },
    encoding: 'utf8',
  })
  if (r.status !== 0) {
    throw new Error(r.stderr || r.stdout || 'perf sample child failed')
  }
  const lines = String(r.stdout || '')
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const ms = Number(lines.at(-1))
  if (!Number.isFinite(ms)) throw new Error(`invalid sample ms: ${r.stdout}`)
  return ms
}

async function runSampleMode() {
  const t0 = performance.now()
  const { initDb } = await import('../server/src/db.js')
  initDb()
  process.stdout.write(String(performance.now() - t0))
}

async function main() {
  if (process.argv.includes('--sample')) {
    await runSampleMode()
    return
  }

  sampleDbInitMsInChild()
  const dbInitMs = sampleDbInitMsInChild()
  const samples = {
    recordedAt: new Date().toISOString(),
    node: process.version,
    metrics: {
      dbInitMs: Math.round(dbInitMs * 100) / 100,
    },
  }

  const mode = process.argv.includes('--write') ? 'write' : 'check'
  if (mode === 'write') {
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true })
    fs.writeFileSync(baselinePath, JSON.stringify(samples, null, 2), 'utf8')
    console.log('Wrote baseline', baselinePath, samples.metrics)
    return
  }

  if (!fs.existsSync(baselinePath)) {
    console.error('Missing baseline; run: node scripts/perf-baseline.mjs --write')
    process.exit(1)
  }
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
  for (const [key, val] of Object.entries(samples.metrics)) {
    const base = baseline.metrics?.[key]
    if (base == null) continue
    if (val > base * THRESHOLD_RATIO) {
      console.error(`Perf regression: ${key}=${val} > ${base} * ${THRESHOLD_RATIO}`)
      process.exit(1)
    }
  }
  console.log('Perf baseline OK', samples.metrics)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
