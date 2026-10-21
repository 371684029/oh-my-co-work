import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-agent-refine-'))
process.env.ACW_DATA_ROOT = dataRoot

const { initDb } = await import('../src/db.js')
initDb()

const { appendAgentRefine } = await import('../src/agentRefine.js')
const { createMember, createSessionFromMember } = await import('../src/services.js')
const { ensureAdminMember } = await import('../src/slashCommands.js')
const { MEMBER_KIND } = await import('@acw/shared')

test('appendAgentRefine dedupes by requestId', () => {
  const session = createSessionFromMember(ensureAdminMember().id)
  const body = {
    sessionId: session.id,
    input: 'need',
    output: 'patch',
    conclusion: 'ok',
    requestId: 'req-dedupe-1',
  }
  const a = appendAgentRefine(body)
  const b = appendAgentRefine(body)
  assert.equal(b.deduped, true)
  assert.equal(a.path, b.path)
})

test('appendAgentRefine rate limits burst calls', () => {
  const echo = createMember({
    name: `refine_rate_${Date.now()}`,
    displayName: '炼化限速',
    kind: MEMBER_KIND.ECHO,
    workFolder: process.cwd(),
    config: { defaultText: 'ok' },
  })
  const session = createSessionFromMember(echo.id)
  for (let i = 0; i < 12; i++) {
    appendAgentRefine({
      sessionId: session.id,
      input: `i${i}`,
      output: 'o',
      conclusion: 'c',
      requestId: `req-rate-${i}`,
    })
  }
  assert.throws(
    () =>
      appendAgentRefine({
        sessionId: session.id,
        input: 'one more',
        output: 'o',
        conclusion: 'c',
        requestId: 'req-rate-over',
      }),
    (e) => e.code === 'RATE_LIMIT',
  )
})
