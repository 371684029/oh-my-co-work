#!/usr/bin/env node
/**
 * Lightweight furnaceGuiTranscript timing smoke (PERF-D2).
 */
import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { furnaceGuiTranscript } from '../shared/ptyPlain.js'

const sample = `${'\x1b[2J'.repeat(20)}User: hello\r\nAssistant: ${'line\n'.repeat(800)}`
const t0 = performance.now()
for (let i = 0; i < 20; i++) {
  furnaceGuiTranscript(sample, { cols: 100, rows: 24, profile: 'cursor' })
}
const ms = performance.now() - t0
assert.ok(ms < 5000, `furnaceGuiTranscript x20 should finish <5s, got ${ms.toFixed(0)}ms`)
console.log(`selftest-furnace-perf ok (${ms.toFixed(0)}ms for 20 parses)`)
