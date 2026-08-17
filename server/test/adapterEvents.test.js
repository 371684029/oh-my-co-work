import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-adapter-evt-'))
process.env.ACW_DATA_ROOT = dataRoot

const { initDb } = await import('../src/db.js')
initDb()
const { createMember, createGroup, createSessionFromGroup, getSessionDetail } = await import(
  '../src/services.js'
)
const { applyAdapterEvent, answerAdapterQuestion } = await import('../src/engine.js')
const { MEMBER_KIND } = await import('@acw/shared')

function makeSession() {
  const member = createMember({
    name: `echo-adp-${Date.now()}-${Math.random()}`,
    displayName: '适配器测试',
    kind: MEMBER_KIND.ECHO,
    workFolder: process.cwd(),
    config: { defaultText: 'ok' },
  })
  const group = createGroup({
    title: `组 ${member.id}`,
    description: 'adapter',
    workFolder: process.cwd(),
    steps: [{ title: '回声', type: 'member', memberId: member.id, gate: false }],
  })
  return { session: createSessionFromGroup(group.id), member }
}

test('adapter question becomes a chat gate and answer clears it', () => {
  const { session, member } = makeSession()
  const node = getSessionDetail(session.id).nodes[0]
  applyAdapterEvent({
    sessionId: session.id,
    nodeInstanceId: node.id,
    memberId: member.id,
    terminalId: 'term_test',
    event: { type: 'question', id: 'q1', text: '是否继续部署？', choices: ['继续', '取消'] },
  })
  const after = getSessionDetail(session.id)
  const gate = after.messages.find((m) => m.content?.mode === 'adapter_question')
  assert.ok(gate)
  assert.equal(after.session.context.pendingAdapterQuestions[0].id, 'q1')
  applyAdapterEvent({
    sessionId: session.id,
    nodeInstanceId: node.id,
    memberId: member.id,
    terminalId: 'term_test',
    event: { type: 'result', summary: '部署完成', files: ['app.js'] },
  })
  const withResult = getSessionDetail(session.id)
  assert.equal(
    withResult.messages.some((m) => m.type === 'adapter_result'),
    true,
  )
  answerAdapterQuestion(session.id, { questionId: 'q1', choice: '继续' })
  const done = getSessionDetail(session.id)
  assert.equal((done.session.context.pendingAdapterQuestions || []).length, 0)
})
