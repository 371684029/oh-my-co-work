#!/usr/bin/env node
/**
 * ENG-02: record lightweight perf samples and compare to committed baseline.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const baselinePath = path.join(root, 'server/test/fixtures/perf-baseline.json')

const THRESHOLD_RATIO = 2.5

async function sampleDbInit() {
  const t0 = performance.now()
  process.env.ACW_DATA_ROOT = fs.mkdtempSync(path.join(root, 'server/test/fixtures/.perf-'))
  const { initDb } = await import('../server/src/db.js')
  initDb()
  return performance.now() - t0
}

async function main() {
  const dbInitMs = await sampleDbInit()
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
