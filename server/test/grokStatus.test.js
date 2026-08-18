import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-grok-home-'))
process.env.GROK_HOME = home

const {
  probeGrokStatus,
  loadGrokExampleConfig,
} = await import('../src/grokStatus.js')

test('probe reports install/login/config gaps when grok home is empty', () => {
  const s = probeGrokStatus({ command: 'grok-acw-missing-binary' })
  assert.equal(s.installed, false)
  assert.equal(s.loggedIn, false)
  assert.equal(s.configured, false)
  assert.equal(s.ready, false)
  assert.ok(s.gaps.includes('install'))
  assert.ok(s.gaps.includes('login'))
  assert.ok(s.gaps.includes('config'))
})

test('example config uses placeholder keys only', () => {
  const raw = loadGrokExampleConfig()
  assert.ok(raw.includes('api_key = "秘钥"'))
  assert.equal(/api_key\s*=\s*"(?!秘钥)[^"]+"/.test(raw), false)
  assert.ok(raw.includes('[models]'))
  assert.ok(raw.includes('deepseek-v4-pro'))
})

test('real key in config.toml counts as configured and logged in', () => {
  fs.writeFileSync(
    path.join(home, 'config.toml'),
    `[models]\ndefault = "x"\n[model.x]\nmodel = "x"\napi_key = "sk-not-a-placeholder"\n`,
    'utf8',
  )
  const s = probeGrokStatus({ command: 'grok-acw-missing-binary' })
  assert.equal(s.configured, true)
  assert.equal(s.loggedIn, true)
  assert.equal(s.installed, false)
  assert.ok(!s.gaps.includes('config'))
  assert.ok(!s.gaps.includes('login'))
})
