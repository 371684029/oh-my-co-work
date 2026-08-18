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
const { grokCanRun, grokSetupNeeded } = await import('@acw/shared')

test('probe reports install/login/config gaps when grok home is empty', () => {
  const s = probeGrokStatus({ command: 'grok-acw-missing-binary' })
  assert.equal(s.installed, false)
  assert.equal(s.loggedIn, false)
  assert.equal(s.configured, false)
  assert.equal(s.ready, false)
  assert.equal(s.canRun, false)
  assert.ok(s.gaps.includes('install'))
  assert.ok(s.gaps.includes('login'))
  assert.ok(s.gaps.includes('config'))
  assert.equal(grokCanRun(s), false)
  assert.equal(grokSetupNeeded(s), true)
})

test('example config uses placeholder keys only', () => {
  const raw = loadGrokExampleConfig()
  assert.ok(raw.includes('api_key = "秘钥"'))
  assert.equal(/api_key\s*=\s*"(?!秘钥)[^"]+"/.test(raw), false)
  assert.ok(raw.includes('[models]'))
  assert.ok(raw.includes('deepseek-v4-pro'))
})

test('official login without custom keys can run but is not fully configured', () => {
  const bin = path.join(home, 'bin')
  fs.mkdirSync(bin, { recursive: true })
  fs.writeFileSync(path.join(bin, 'grok'), '', 'utf8')
  fs.writeFileSync(path.join(home, 'auth.json'), '{"user":"x"}', 'utf8')
  fs.writeFileSync(
    path.join(home, 'config.toml'),
    `[models]\ndefault = "x"\n[model.x]\nmodel = "x"\napi_key = "秘钥"\n`,
    'utf8',
  )
  const s = probeGrokStatus({ command: 'grok-acw-missing-binary' })
  assert.equal(s.installed, true)
  assert.equal(s.loggedIn, true)
  assert.equal(s.configured, false)
  assert.equal(s.canRun, true)
  assert.equal(s.ready, false)
  assert.ok(s.gaps.includes('config'))
  assert.equal(grokCanRun(s), true)
  assert.equal(grokSetupNeeded(s), false)
})

test('setup is not needed when probe can run, even without settings opt-in', () => {
  assert.equal(grokSetupNeeded({ installed: true, loggedIn: true, configured: true, canRun: true }), false)
  assert.equal(grokSetupNeeded({ installed: true, loggedIn: true, configured: false, canRun: true }), false)
  assert.equal(grokSetupNeeded(null), true)
})
