import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-member-verify-'))
process.env.ACW_DATA_ROOT = dataRoot

const { initDb } = await import('../src/db.js')
initDb()
const { createMember, getMember } = await import('../src/services.js')
const { MEMBER_KIND } = await import('@acw/shared')
const {
  verifyMemberSync,
  runScriptProbeSync,
  shouldAutoVerifyRefine,
  DEFAULT_PROBE_INPUT,
} = await import('../src/memberVerify.js')

test('shouldAutoVerifyRefine skips patch_failed', () => {
  const m = { kind: 'script', config: { refine: { enabled: true }, script: { command: 'node x.js' } } }
  assert.equal(shouldAutoVerifyRefine(m, { reason: 'patch_failed', fallback: true }), false)
  assert.equal(shouldAutoVerifyRefine(m, { reason: 'ok', patched: ['a.js'] }), true)
})

test('verifyMemberSync: script with refine heading in stdout', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-verify-script-'))
  const file = path.join(dir, 'probe.mjs')
  fs.writeFileSync(
    file,
    `console.log("### 探针标题\\n");\nconsole.log(process.env.ACW_HUMAN_INPUT || "");\n`,
    'utf8',
  )
  const member = {
    id: 'mem_probe',
    kind: 'script',
    display_name: '探针',
    config: {
      refine: {
        enabled: true,
        format: {
          title: '探针标题',
          output: { channel: 'stdout', heading: '探针标题' },
        },
      },
      script: {
        mode: 'file',
        filePath: file,
        scriptWorkDir: dir,
        executionMode: 'pipe',
      },
    },
  }
  const v = verifyMemberSync(member, { humanInput: DEFAULT_PROBE_INPUT })
  assert.equal(v.ok, true, JSON.stringify(v.checks))
  assert.ok(v.checks.some((c) => c.id === 'refine_stdout_heading' && c.ok))
})

test('createMember with refine patches and auto-verify passes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-verify-create-'))
  const file = path.join(dir, 'run.mjs')
  fs.writeFileSync(file, 'console.log("legacy")\n', 'utf8')

  const saved = createMember({
    name: `verify_${Date.now()}`,
    displayName: '炼化自动验证',
    kind: MEMBER_KIND.SCRIPT,
    config: {
      refine: { enabled: true },
      script: {
        mode: 'file',
        filePath: file,
        scriptWorkDir: dir,
        command: `node ${path.basename(file)} #1`,
        executionMode: 'pipe',
      },
    },
  })
  assert.ok(saved.verifyResult, '保存后应返回 verifyResult')
  assert.equal(saved.verifyResult.ok, true, JSON.stringify(saved.verifyResult))
  const got = getMember(saved.id)
  assert.equal(got.config.refine.verifyLast?.ok, true)
  assert.equal(!!got.config.refine.verifyFailed, false)
})

test('verifyMemberSync fails when stdout missing heading', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-verify-fail-'))
  const file = path.join(dir, 'bad.mjs')
  fs.writeFileSync(file, 'console.log("no heading")\n', 'utf8')
  const member = {
    kind: 'script',
    config: {
      refine: {
        enabled: true,
        format: { title: '应有标题', output: { heading: '应有标题' } },
      },
      script: { mode: 'file', filePath: file, scriptWorkDir: dir, executionMode: 'pipe' },
    },
  }
  const v = verifyMemberSync(member)
  assert.equal(v.ok, false)
  const h = v.checks.find((c) => c.id === 'refine_stdout_heading')
  assert.ok(h && !h.ok)
})

test('verifyMemberSync: .sh refine heading in stdout', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-verify-sh-'))
  const sh = path.join(dir, 'run.sh')
  fs.writeFileSync(sh, '#!/bin/sh\n# ACW-REFINE: probe\necho "### Sh标题"\n', 'utf8')
  fs.chmodSync(sh, 0o755)
  const member = {
    kind: 'script',
    config: {
      refine: {
        enabled: true,
        format: { title: 'Sh标题', output: { heading: 'Sh标题' } },
      },
      script: {
        mode: 'file',
        filePath: sh,
        scriptWorkDir: dir,
        executionMode: 'pipe',
      },
    },
  }
  const v = verifyMemberSync(member)
  assert.equal(v.ok, true, JSON.stringify(v.checks))
})

test('verifyMemberSync accepts injected runProbe', () => {
  const member = {
    kind: 'script',
    config: {
      refine: { enabled: true, format: { output: { heading: '注入标题' } } },
      script: {
        mode: 'command',
        command: 'node -e "process.exit(0)"',
        scriptWorkDir: process.cwd(),
        executionMode: 'pipe',
      },
    },
  }
  const v = verifyMemberSync(member, {
    runProbe: () => ({
      exitOk: true,
      exitCode: 0,
      stdout: '### 注入标题\n',
      stderr: '',
      reason: 'ok',
    }),
  })
  assert.equal(v.ok, true)
})
