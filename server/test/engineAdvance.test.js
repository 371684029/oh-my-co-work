import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

// 表征测试：3.8.0 拆分 engine.js 前锁定 advance 主循环行为。
// 通过公共门面（engine.js / services.js）驱动，拆分后必须原样通过。

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-engine-advance-'))
process.env.ACW_DATA_ROOT = dataRoot

const { initDb } = await import('../src/db.js')
initDb()
const { createMember, createGroup, createSessionFromGroup, getSessionDetail, handleGateAction, postUserMessage, restartFromNode } =
  await import('../src/services.js')
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

async function makeEchoStepSession(steps, name) {
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
    steps: steps(member.id),
  })
  return createSessionFromGroup(group.id)
}

const FLOW_OFF = { admin: false, auto: false, human: false }

test('advance stops at a human-input gate; submit captures params then completes', async () => {
  const session = await makeEchoStepSession(
    (id) => [
      { title: '填写参数', type: 'human', gate: false },
      { title: '回声', type: 'member', memberId: id, gate: false, flow: FLOW_OFF },
    ],
    'human-gate',
  )
  await handleGateAction(session.id, { action: 'approve_start', text: '开始' })
  const d1 = await poll(() => {
    const d = getSessionDetail(session.id)
    return d.nodes[0].status === 'waiting_human' ? d : null
  })
  assert.equal(d1.nodes[0].status, 'waiting_human')
  assert.equal(d1.session.status, SESSION_STATUS.WAITING_HUMAN)
  assert.equal(d1.messages.some((m) => m.content?.mode === 'human_input'), true)

  const r = await handleGateAction(session.id, {
    action: 'submit',
    text: 'p1 p2',
    nodeInstanceId: d1.nodes[0].id,
  })
  assert.equal(r.ok, true)
  assert.equal(r.submitted, true)

  const d2 = await poll(async () => {
    const d = getSessionDetail(session.id)
    return d.session.status === SESSION_STATUS.ARCHIVED ? d : null
  })
  assert.equal(d2.nodes[0].status, 'succeeded')
  // 参数追加语义：启动文本「开始」占 #1，人工步输入递增为 #2、#3
  assert.equal(d2.session.context.params?.['#1'], '开始')
  assert.equal(d2.session.context.params?.['#2'], 'p1')
  assert.equal(d2.session.context.params?.['#3'], 'p2')
  assert.equal(d2.nodes[1].status, 'succeeded')
})

test('mid-flow offsite step pauses the flow; forward jump resumes and archives it', async () => {
  const session = await makeEchoStepSession(
    (id) => [
      { title: '回声一', type: 'member', memberId: id, gate: false, flow: FLOW_OFF },
      { title: '外卖', type: 'offsite' },
      { title: '回声二', type: 'member', memberId: id, gate: false, flow: FLOW_OFF },
    ],
    'offsite-pause',
  )
  await handleGateAction(session.id, { action: 'approve_start', text: '开始' })
  const d1 = await poll(() => {
    const d = getSessionDetail(session.id)
    return d.session.context?.offsiteAssist?.active ? d : null
  })
  assert.equal(d1.session.status, SESSION_STATUS.WAITING_HUMAN)
  const offsite = d1.nodes.find((n) => n.step_type === 'offsite')
  assert.equal(offsite.status, 'waiting_human')

  const r = await restartFromNode(session.id, { nodeInstanceId: d1.nodes[2].id })
  assert.equal(r.ok, true)
  assert.equal(r.forwardJump, true)

  const d2 = await poll(async () => {
    const d = getSessionDetail(session.id)
    return d.session.status === SESSION_STATUS.ARCHIVED ? d : null
  })
  const offsiteAfter = d2.nodes.find((n) => n.step_type === 'offsite')
  assert.equal(offsiteAfter.status, 'succeeded')
  assert.equal(offsiteAfter.output?.archived, true)
  assert.ok(offsiteAfter.output?.closeToken)
  assert.equal(d2.nodes[2].status, 'succeeded')
})

test('member requiring #1 is blocked until params are submitted', async () => {
  const member = createMember({
    name: `echo-need-params-${Date.now()}`,
    displayName: '缺参回声',
    kind: MEMBER_KIND.ECHO,
    workFolder: process.cwd(),
    config: { defaultText: 'ok', requiresParams: ['#1'] },
  })
  const group = createGroup({
    title: '缺参组',
    workFolder: process.cwd(),
    steps: [{ title: '回声', type: 'member', memberId: member.id, gate: false, flow: FLOW_OFF }],
  })
  const session = createSessionFromGroup(group.id)
  await handleGateAction(session.id, { action: 'approve_start', text: '' })

  const d1 = await poll(() => {
    const d = getSessionDetail(session.id)
    return d.nodes[0].status === 'waiting_human' ? d : null
  })
  assert.equal(d1.nodes[0].output?.needParams, true)
  assert.equal(d1.messages.some((m) => m.content?.mode === 'need_params'), true)

  const r = await handleGateAction(session.id, {
    action: 'submit',
    text: '参数一',
    nodeInstanceId: d1.nodes[0].id,
  })
  assert.equal(r.ok, true)
  assert.equal(r.needParamsFilled, true)

  const d2 = await poll(async () => {
    const d = getSessionDetail(session.id)
    return d.session.status === SESSION_STATUS.ARCHIVED ? d : null
  })
  assert.equal(d2.session.context.params?.['#1'], '参数一')
  assert.equal(d2.nodes[0].status, 'succeeded')
})

test('auto-vote review gate stays pending after success; approve passes and archives', async () => {
  const session = await makeEchoStepSession(
    (id) => [{ title: '回声', type: 'member', memberId: id, gate: false }],
    'auto-gate',
  )
  await handleGateAction(session.id, { action: 'approve_start', text: '开始' })
  const d1 = await poll(() => {
    const d = getSessionDetail(session.id)
    return d.nodes[0].status === 'waiting_human' ? d : null
  })
  assert.equal(d1.session.status, SESSION_STATUS.WAITING_HUMAN)
  const gateMsg = d1.messages.filter((m) => m.content?.mode === 'gate').pop()
  assert.equal(gateMsg.content.humanAction, 'pending')
  assert.equal(d1.nodes[0].output?.votes?.auto, true)
  assert.equal(d1.nodes[0].output?.humanAction, 'pending')

  const r = await handleGateAction(session.id, {
    action: 'approve',
    nodeInstanceId: d1.nodes[0].id,
  })
  assert.equal(r.ok, true)
  assert.equal(r.passed, true)

  await poll(async () => {
    const d = getSessionDetail(session.id)
    return d.session.status === SESSION_STATUS.ARCHIVED ? d : null
  })
  const d3 = getSessionDetail(session.id)
  assert.equal(d3.nodes[0].status, 'succeeded')
  assert.equal(d3.nodes[0].output?.humanAction, 'approve')
})

test('human review gate requires approve; reject fails the node', async () => {
  const sessionA = await makeEchoStepSession(
    (id) => [{ title: '回声', type: 'member', memberId: id, gate: false, flow: { human: true } }],
    'human-review-a',
  )
  await handleGateAction(sessionA.id, { action: 'approve_start', text: '开始' })
  const dA = await poll(() => {
    const d = getSessionDetail(sessionA.id)
    return d.nodes[0].status === 'waiting_human' ? d : null
  })
  assert.equal(dA.nodes[0].output?.requireHuman, true)
  const rA = await handleGateAction(sessionA.id, {
    action: 'approve',
    nodeInstanceId: dA.nodes[0].id,
  })
  assert.equal(rA.passed, true)
  await poll(async () => {
    const d = getSessionDetail(sessionA.id)
    return d.session.status === SESSION_STATUS.ARCHIVED ? d : null
  })
  assert.equal(getSessionDetail(sessionA.id).nodes[0].status, 'succeeded')

  const sessionB = await makeEchoStepSession(
    (id) => [{ title: '回声', type: 'member', memberId: id, gate: false, flow: { human: true } }],
    'human-review-b',
  )
  await handleGateAction(sessionB.id, { action: 'approve_start', text: '开始' })
  const dB = await poll(() => {
    const d = getSessionDetail(sessionB.id)
    return d.nodes[0].status === 'waiting_human' ? d : null
  })
  const rB = await handleGateAction(sessionB.id, {
    action: 'reject',
    nodeInstanceId: dB.nodes[0].id,
  })
  assert.equal(rB.ok, true)
  assert.equal(rB.rejected, true)
  const after = getSessionDetail(sessionB.id)
  assert.equal(after.nodes[0].status, 'failed')
  assert.equal(after.nodes[0].output?.humanAction, 'reject')
})

test('chat message during review keeps humanAction pending and records a note', async () => {
  const session = await makeEchoStepSession(
    (id) => [{ title: '回声', type: 'member', memberId: id, gate: false }],
    'chat-note',
  )
  await handleGateAction(session.id, { action: 'approve_start', text: '开始' })
  const d1 = await poll(() => {
    const d = getSessionDetail(session.id)
    return d.nodes[0].status === 'waiting_human' ? d : null
  })

  const r = await postUserMessage(session.id, '补充说明一句')
  // 审核闸门的 member 节点不算「主闸门等待」（只有 human / needParams 节点算）
  assert.equal(r.mainGateWaiting, false)

  const d2 = getSessionDetail(session.id)
  assert.equal(d2.nodes[0].output?.humanAction, 'pending')
  assert.equal(d2.nodes[0].output?.pendingNotes?.[0]?.text, '补充说明一句')
  const notes = d2.session.context?.userNotes || []
  assert.equal(notes.some((n) => n.text === '补充说明一句'), true)
  // 会话仍在等待，未被聊天推进
  assert.equal(d2.session.status, SESSION_STATUS.WAITING_HUMAN)
})
