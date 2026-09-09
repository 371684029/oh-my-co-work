import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

// 4.5 熔炉炼化：成员/群步骤炼化字段透传 + advance.js 节点完成后集成。
const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-refine-'))
process.env.ACW_DATA_ROOT = dataRoot

const { initDb, getDb } = await import('../src/db.js')
initDb()
const {
  createMember,
  getMember,
  createGroup,
  getGroup,
  createSessionFromGroup,
  getSessionDetail,
  handleGateAction,
} = await import('../src/services.js')
const { MEMBER_KIND } = await import('@acw/shared')

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

test('createMember 透传 config.refine；updateMember 保留', () => {
  const m = createMember({
    name: `ref-${Date.now()}-${Math.random()}`,
    displayName: '炼化成员',
    kind: MEMBER_KIND.ECHO,
    config: { refine: { enabled: true, status: 'pending' }, defaultText: 'ok' },
  })
  const got = getMember(m.id)
  assert.equal(got.config.refine.enabled, true)
  assert.equal(got.config.refine.status, 'pending')
})

test('createGroup 透传 step.refine；normalizeSteps 归一为布尔', () => {
  const m = createMember({
    name: `g-${Date.now()}-${Math.random()}`,
    displayName: '绑定成员',
    kind: MEMBER_KIND.ECHO,
    config: { defaultText: 'ok' },
  })
  const g = createGroup({
    title: '末班组',
    workFolder: process.cwd(),
    steps: [
      { title: '炼化步', type: 'member', memberId: m.id, gate: false, refine: true },
      { title: '普通步', type: 'member', memberId: m.id, gate: false, refine: false },
    ],
  })
  const got = getGroup(g.id)
  assert.equal(got.steps[0].refine, true)
  assert.equal(!!got.steps[1].refine, false) // 未炼化 → undefined/falsy
})

const FLOW_OFF = { admin: false, auto: false, human: false }

test('advance 集成：步骤勾炼化(未炼化成员)完成后 input 带 refine 标记与格式化文本', async () => {
  const m = createMember({
    name: `i-${Date.now()}-${Math.random()}`,
    displayName: '文档员',
    kind: MEMBER_KIND.ECHO,
    config: { defaultText: '节点产出内容' }, // 未开启炼化
  })
  const g = createGroup({
    title: '集成组',
    workFolder: process.cwd(),
    steps: [{ title: '炼化步', type: 'member', memberId: m.id, gate: false, flow: FLOW_OFF, refine: true }],
  })
  const session = createSessionFromGroup(g.id)
  await handleGateAction(session.id, { action: 'approve_start', text: '开始' })
  const detail = await poll(() => {
    const d = getSessionDetail(session.id)
    if (d.nodes.every((n) => n.status === 'succeeded' || n.status === 'failed')) return d
    return null
  })
  assert.ok(detail, '会话应完成')
  const node = detail.nodes.find((n) => n.input?.refine)
  assert.ok(node, '完成的节点应带 refine 标记')
  assert.equal(node.input.refine.fallback, true) // 未炼化 → 格式化节点
  assert.equal(node.input.refine.source, 'formatter')
  assert.ok(node.input.refineFormatted.includes('文档员 产出'))
  assert.ok(node.input.refineFormatted.includes('节点产出内容'))
})

test('advance 集成：未勾炼化则 input 无 refine 标记', async () => {
  const m = createMember({
    name: `n-${Date.now()}-${Math.random()}`,
    displayName: '普通成员',
    kind: MEMBER_KIND.ECHO,
    config: { defaultText: '普通产出' },
  })
  const g = createGroup({
    title: '非炼化组',
    workFolder: process.cwd(),
    steps: [{ title: '普通步', type: 'member', memberId: m.id, gate: false, flow: FLOW_OFF }],
  })
  const session = createSessionFromGroup(g.id)
  await handleGateAction(session.id, { action: 'approve_start', text: '开始' })
  const detail = await poll(() => {
    const d = getSessionDetail(session.id)
    if (d.nodes.every((n) => n.status === 'succeeded' || n.status === 'failed')) return d
    return null
  })
  assert.ok(detail)
  const node = detail.nodes[0]
  assert.equal(!!node.input?.refine, false)
})

test('advance 集成：已炼化成员(开启但无规格)首轮产出规格并回写，本轮起 source=spec', async () => {
  const m = createMember({
    name: `s-${Date.now()}-${Math.random()}`,
    displayName: '台账员',
    kind: MEMBER_KIND.ECHO,
    config: { defaultText: '首次产出内容', refine: { enabled: true, status: 'pending' } },
  })
  const g = createGroup({
    title: '规格组',
    workFolder: process.cwd(),
    steps: [{ title: '炼化步', type: 'member', memberId: m.id, gate: false, flow: FLOW_OFF, refine: true }],
  })
  const session = createSessionFromGroup(g.id)
  await handleGateAction(session.id, { action: 'approve_start', text: '开始' })
  const detail = await poll(() => {
    const d = getSessionDetail(session.id)
    if (d.nodes.every((n) => n.status === 'succeeded' || n.status === 'failed')) return d
    return null
  })
  assert.ok(detail)
  const node = detail.nodes.find((n) => n.input?.refine)
  assert.ok(node, '应带 refine 标记')
  assert.equal(node.input.refine.source, 'spec') // 本轮已按新规格格式化
  assert.equal(node.input.refine.refined, true)
  assert.ok(node.input.refineFormatted.includes('台账员 产出台账'))
  // 核心交付：炼化正文应真正写入节点台账 step-*.md（readDoc 可读到）
  assert.ok(node.journalPath, '节点应有 journal_path')
  const jm = fs.readFileSync(path.join(process.env.ACW_DATA_ROOT, node.journalPath), 'utf8')
  assert.ok(jm.includes('台账员 产出台账'), 'step-*.md 应包含炼化规格标题')
  assert.ok(jm.includes('首次产出内容'), 'step-*.md 应包含炼化正文')
  // 规格已回写
  const after = getMember(m.id)
  assert.equal(after.config.refine.status, 'done')
  assert.equal(after.config.refine.format.title, '台账员 产出台账')
})
