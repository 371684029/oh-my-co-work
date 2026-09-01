import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

// 表征测试：3.8.0 拆分 engine.js 前锁定闸门动作语义。
// 通过公共门面（engine.js / services.js）驱动，拆分后必须原样通过。

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-engine-gates-'))
process.env.ACW_DATA_ROOT = dataRoot

const { initDb, getDb } = await import('../src/db.js')
initDb()
const {
  createMember,
  createGroup,
  createSessionFromGroup,
  getSessionDetail,
  handleGateAction,
} = await import('../src/services.js')
const { applyAdapterEvent } = await import('../src/engine.js')
const { markInterruptedOnBoot, resolveInterruptedSession } = await import('../src/engine.js')
const { MEMBER_KIND, SESSION_STATUS } = await import('@acw/shared')

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function poll(fn, times = 60) {
  let out
  for (let i = 0; i < times; i++) {
    out = await fn()
    if (out) return out
    await wait(25)
  }
  return out
}

const FLOW_OFF = { admin: false, auto: false, human: false }

async function makeSession(name, stepOverrides = {}) {
  const member = createMember({
    name: `echo-${name}-${Date.now()}-${Math.random()}`,
    displayName: '回声成员',
    kind: MEMBER_KIND.ECHO,
    workFolder: process.cwd(),
    config: { defaultText: 'ok' },
  })
  const group = createGroup({
    title: `组 ${name}`,
    workFolder: process.cwd(),
    steps: [
      {
        title: '回声',
        type: 'member',
        memberId: member.id,
        gate: false,
        ...stepOverrides,
      },
    ],
  })
  return createSessionFromGroup(group.id)
}

async function startAndReachGate(sessionId) {
  await handleGateAction(sessionId, { action: 'approve_start', text: '开始' })
  const d = await poll(() => {
    const det = getSessionDetail(sessionId)
    return det.nodes[0].status === 'waiting_human' ? det : null
  })
  return d
}

test('same idempotencyKey replays the first gate result instead of double-running', async () => {
  const session = await makeSession('idem')
  const d = await startAndReachGate(session.id)

  const r1 = await handleGateAction(session.id, {
    action: 'approve',
    nodeInstanceId: d.nodes[0].id,
    idempotencyKey: 'k1',
  })
  assert.equal(r1.ok, true)
  assert.equal(r1.passed, true)

  const r2 = await handleGateAction(session.id, {
    action: 'approve',
    nodeInstanceId: d.nodes[0].id,
    idempotencyKey: 'k1',
  })
  assert.equal(r2.idempotentReplay, true)
  assert.equal(r2.passed, true)

  await poll(async () => {
    const det = getSessionDetail(session.id)
    return det.session.status === SESSION_STATUS.ARCHIVED ? det : null
  })
  // 只跑一次：节点没有重复推进，会话正常归档
  const after = getSessionDetail(session.id)
  assert.equal(after.nodes[0].status, 'succeeded')
  assert.equal(after.session.status, SESSION_STATUS.ARCHIVED)
})

test('archived session rejects gate actions with code ARCHIVED', async () => {
  const session = await makeSession('arch-err', { flow: FLOW_OFF })
  await handleGateAction(session.id, { action: 'approve_start', text: '开始' })
  await poll(async () => {
    const d = getSessionDetail(session.id)
    return d.session.status === SESSION_STATUS.ARCHIVED ? d : null
  })
  await assert.rejects(
    () => handleGateAction(session.id, { action: 'approve' }),
    (e) => e.code === 'ARCHIVED',
  )
})

test('re-approving an approved node is idempotent; approving a rejected node is NOT_WAITING', async () => {
  const session = await makeSession('idem2')
  const d = await startAndReachGate(session.id)
  const r1 = await handleGateAction(session.id, {
    action: 'approve',
    nodeInstanceId: d.nodes[0].id,
  })
  assert.equal(r1.passed, true)
  // 无幂等键的重复同意：走节点态幂等
  const r2 = await handleGateAction(session.id, {
    action: 'approve',
    nodeInstanceId: d.nodes[0].id,
  })
  assert.equal(r2.ok, true)
  assert.equal(r2.idempotent, true)
})

test('rejecting then approving the same node throws NOT_WAITING', async () => {
  const session = await makeSession('reject-then-approve')
  const d = await startAndReachGate(session.id)
  const r = await handleGateAction(session.id, {
    action: 'reject',
    nodeInstanceId: d.nodes[0].id,
  })
  assert.equal(r.rejected, true)
  await assert.rejects(
    () =>
      handleGateAction(session.id, {
        action: 'approve',
        nodeInstanceId: d.nodes[0].id,
      }),
    (e) => e.code === 'NOT_WAITING',
  )
})

test('cancel_start archives the session with reason start_cancelled', async () => {
  const session = await makeSession('cancel-start', { flow: FLOW_OFF })
  const r = await handleGateAction(session.id, { action: 'cancel_start' })
  assert.equal(r.cancelled, true)
  const d = await poll(async () => {
    const det = getSessionDetail(session.id)
    return det.session.status === SESSION_STATUS.ARCHIVED ? det : null
  })
  assert.equal(d.session.archive_reason, 'start_cancelled')
})

test('adapter question routes through handleGateAction and clears pending', async () => {
  const session = await makeSession('adapter-q', { flow: FLOW_OFF })
  applyAdapterEvent({
    sessionId: session.id,
    event: { type: 'question', id: 'q-1', text: '继续吗？', choices: ['是', '否'] },
  })
  const d1 = getSessionDetail(session.id)
  assert.equal(d1.session.context.pendingAdapterQuestions?.length, 1)
  assert.equal(
    d1.messages.some((m) => m.content?.mode === 'adapter_question' && m.content?.questionId === 'q-1'),
    true,
  )

  const r = await handleGateAction(session.id, { questionId: 'q-1', text: '是' })
  assert.equal(r.ok, true)
  assert.equal(r.questionId, 'q-1')
  assert.equal(r.answer, '是')

  const d2 = getSessionDetail(session.id)
  assert.equal(d2.session.context.pendingAdapterQuestions?.length, 0)
})

test('approve with a note records humanNote and lastHumanInput', async () => {
  const session = await makeSession('approve-note')
  const d = await startAndReachGate(session.id)
  const r = await handleGateAction(session.id, {
    action: 'approve',
    nodeInstanceId: d.nodes[0].id,
    text: '同意，效果不错',
  })
  assert.equal(r.passed, true)
  await poll(async () => {
    const det = getSessionDetail(session.id)
    return det.session.status === SESSION_STATUS.ARCHIVED ? det : null
  })
  const after = getSessionDetail(session.id)
  assert.equal(after.nodes[0].output?.humanNote, '同意，效果不错')
  assert.equal(after.session.context?.lastHumanInput, '同意，效果不错')
})

// 注意：本测试放最后——markInterruptedOnBoot 会标记本库中所有未归档会话
test('interrupted session blocks normal gate actions; discard resolves to failed', async () => {
  const session = await makeSession('interrupted', { flow: FLOW_OFF })
  assert.equal(session.status, SESSION_STATUS.WAITING_HUMAN)

  markInterruptedOnBoot()
  const d1 = getSessionDetail(session.id)
  assert.equal(d1.session.status, SESSION_STATUS.INTERRUPTED)

  await assert.rejects(
    () => handleGateAction(session.id, { action: 'approve' }),
    (e) => e.code === 'INTERRUPTED',
  )

  const r = await resolveInterruptedSession(session.id, 'discard')
  assert.equal(r.ok, true)
  assert.equal(r.discarded, true)
  const d2 = getSessionDetail(session.id)
  assert.equal(d2.session.status, SESSION_STATUS.FAILED)
  assert.equal(d2.nodes[0].status, 'skipped')
  assert.equal(d2.session.context?.interrupted?.resolution, 'discard')
})
