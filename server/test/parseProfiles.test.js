import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-parse-'))
process.env.ACW_DATA_ROOT = dataRoot

const { listParseProfiles, recordParseSample, listParseSamples } = await import(
  '../src/parseProfiles.js'
)

test('parse profiles and golden samples roundtrip', () => {
  const profiles = listParseProfiles()
  assert.ok(profiles.some((p) => p.id === 'grok'))
  const entry = recordParseSample({ agentId: 'grok', raw: 'line1\nline2', note: 'test' })
  assert.ok(entry.id)
  const samples = listParseSamples('grok')
  assert.equal(samples.length, 1)
  assert.equal(samples[0].raw, 'line1\nline2')
})
