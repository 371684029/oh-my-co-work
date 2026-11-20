import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
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
const { applyRefineContract } = await import('../src/refineSource.js')

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

test('patched script keeps a later non-zero exit; a heading that stays up counts as resident', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-verify-resident-'))
  const file = path.join(dir, 'short.mjs')
  fs.writeFileSync(file, 'console.log("work")\nprocess.exit(2)\n', 'utf8')
  const patched = applyRefineContract(file, { title: '短标题' })
  assert.equal(patched.patched, true)
  assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /ACW_VERIFY/)
  const failed = verifyMemberSync({
    kind: 'script',
    display_name: '短脚本',
    config: {
      refine: { enabled: true, format: { title: '短标题', output: { heading: '短标题' } } },
      script: { mode: 'file', filePath: file, scriptWorkDir: dir, executionMode: 'pipe' },
    },
  })
  assert.equal(failed.ok, false, JSON.stringify(failed.checks))
  assert.match(JSON.stringify(failed.checks), /退出码 2/)
  assert.equal(failed.checks.some((c) => c.detail === 'EXIT'), false)
  const bare = spawnSync(process.execPath, [file], { cwd: dir, encoding: 'utf8' })
  assert.equal(bare.status, 2)

  const live = path.join(dir, 'serve.mjs')
  fs.writeFileSync(live, 'console.log("### 常驻标题")\nsetInterval(() => {}, 1000)\n', 'utf8')
  const resident = verifyMemberSync(
    {
      kind: 'script',
      display_name: '常驻',
      config: {
        refine: { enabled: true, format: { title: '常驻标题', output: { heading: '常驻标题' } } },
        script: { mode: 'file', filePath: live, scriptWorkDir: dir, executionMode: 'pipe' },
      },
    },
    { residentGraceMs: 300, timeoutMs: 4000 },
  )
  assert.equal(resident.ok, true, JSON.stringify(resident.checks))
  assert.match(JSON.stringify(resident.checks), /常驻/)
})

test('a probe program that cannot start fails without waiting out the script timeout', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-verify-bad-worker-'))
  const file = path.join(dir, 'ok.mjs')
  fs.writeFileSync(file, 'console.log("### 标题")\n', 'utf8')
  const broken = path.join(dir, 'broken.js')
  fs.writeFileSync(broken, 'not valid javascript {{{', 'utf8')
  const t0 = Date.now()
  const v = verifyMemberSync(
    {
      kind: 'script',
      config: {
        refine: { enabled: true, format: { title: '标题', output: { heading: '标题' } } },
        script: { mode: 'file', filePath: file, scriptWorkDir: dir, executionMode: 'pipe' },
      },
    },
    { workerPath: broken, timeoutMs: 30000 },
  )
  assert.ok(Date.now() - t0 < 5000, `probe hung for ${Date.now() - t0}ms`)
  assert.equal(v.ok, false)
  assert.match(v.checks[0].detail, /进程启动失败/)
})
