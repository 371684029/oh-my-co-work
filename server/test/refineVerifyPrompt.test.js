import assert from 'node:assert/strict'
import test from 'node:test'
import { formatVerifyFailureBrief, buildMemberRefineVerifyPrompt } from '../src/refineVerifyPrompt.js'

test('formatVerifyFailureBrief maps EXIT probe detail', () => {
  const brief = formatVerifyFailureBrief(null, {
    ok: false,
    checks: [
      { id: 'probe_run', ok: false, detail: 'EXIT' },
      { id: 'exit_code', ok: false, detail: '退出码 1（非成功）' },
    ],
    stdoutPreview: 'partial out',
    stderrPreview: 'err',
  })
  assert.match(brief, /进程非零退出/)
  assert.match(brief, /stdout（节选）/)
  assert.match(brief, /partial out/)
})

test('buildMemberRefineVerifyPrompt includes member and furnace skill for grok', () => {
  const member = {
    id: 'mem_test',
    display_name: 'runServe',
    kind: 'script',
    config: {
      refine: {
        enabled: true,
        verifyFailed: true,
        verifyLast: {
          ok: false,
          checks: [{ id: 'probe_run', ok: false, detail: 'EXIT' }],
        },
        format: { title: '### runServe', output: { heading: '### runServe' } },
      },
      script: {
        command: 'node index.mjs',
        scriptWorkDir: '/tmp/proj',
        filePath: 'index.mjs',
      },
    },
  }
  const r = buildMemberRefineVerifyPrompt(member, { target: 'grok' })
  assert.equal(r.target, 'grok')
  assert.match(r.prompt, /runServe/)
  assert.match(r.prompt, /furnace-refine-skill/)
  assert.match(r.prompt, /verify-member/)
  assert.equal(r.member.id, 'mem_test')
  assert.match(r.diffUrl, /pane=refine/)
})

test('buildMemberRefineVerifyPrompt external uses agent refine prompt', () => {
  const member = {
    id: 'm1',
    name: 'Echo',
    kind: 'echo',
    config: {
      refine: {
        enabled: true,
        verifyLast: { ok: false, checks: [{ id: 'refine_echo_format', ok: false, detail: '缺少' }] },
      },
    },
  }
  const r = buildMemberRefineVerifyPrompt(member, { target: 'external', sessionId: 's1' })
  assert.equal(r.target, 'external')
  assert.match(r.prompt, /POST \/api\/docs\/refine/)
  assert.match(r.prompt, /s1/)
})