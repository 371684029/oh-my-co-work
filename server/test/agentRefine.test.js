import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-refine-'))
process.env.ACW_DATA_ROOT = dataRoot
process.env.ACW_APP_SETTINGS_PATH = path.join(dataRoot, 'app-settings.json')

const { initDb } = await import('../src/db.js')
initDb()

const { MEMBER_KIND } = await import('@acw/shared')
const { createMember, createSessionFromMember } = await import('../src/services.js')
const {
  appendAgentRefine,
  appendAgentRefineRaw,
  buildRefineSkillPrompt,
} = await import('../src/agentRefine.js')

test('buildRefineSkillPrompt includes API path and sessionId', () => {
  const p = buildRefineSkillPrompt({ sessionId: 'sess_demo' })
  assert.match(p, /POST \/api\/docs\/refine/)
  assert.match(p, /sess_demo/)
})

test('appendAgentRefine writes 外部 Agent 炼化 into ANNOUNCEMENT.md', () => {
  const member = createMember({
    name: `refine-${Date.now()}`,
    displayName: '炼化测试',
    kind: MEMBER_KIND.ECHO,
    workFolder: process.cwd(),
    config: { defaultText: 'ok' },
  })
  const session = createSessionFromMember(member.id)
  const r = appendAgentRefine({
    sessionId: session.id,
    input: '修双 Agent',
    output: 'git diff 摘要',
    conclusion: '已覆盖测试',
  })
  assert.equal(r.ok, true)
  assert.match(r.markdown, /外部 Agent 炼化/)
  assert.match(r.markdown, /修双 Agent/)
  const abs = path.join(dataRoot, 'journals', 'sessions', session.id, 'ANNOUNCEMENT.md')
  assert.equal(fs.existsSync(abs), true)
})

test('appendAgentRefineRaw can append twice without dropping the first section', () => {
  const sid = `raw-${Date.now()}`
  appendAgentRefineRaw({
    sessionId: sid,
    input: '第一次',
    output: 'a',
    conclusion: 'ok1',
  })
  const second = appendAgentRefineRaw({
    sessionId: sid,
    input: '第二次',
    output: 'b',
    conclusion: 'ok2',
  })
  assert.match(second.markdown, /第一次/)
  assert.match(second.markdown, /第二次/)
})
