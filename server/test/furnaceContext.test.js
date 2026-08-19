import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-furnace-ctx-'))
process.env.ACW_DATA_ROOT = dataRoot
process.env.ACW_GROK_WORKSPACE = path.join(dataRoot, 'grok-ws')

const { FURNACE_ROLE } = await import('@acw/shared')
const {
  composeFurnaceContext,
  composeFurnaceSituation,
  activateFurnaceRole,
  resolveAdaptFurnaceRole,
  loadFurnaceMemory,
  furnaceMemoryDir,
  ensureFurnaceWorkspace,
  clipFurnaceText,
} = await import('../src/furnaceContext.js')

test('three roles compose in isolation', () => {
  const member = composeFurnaceContext(FURNACE_ROLE.MEMBER_ADAPT)
  const node = composeFurnaceContext(FURNACE_ROLE.NODE_ADAPT)
  const review = composeFurnaceContext(FURNACE_ROLE.REVIEW)
  assert.ok(member.includes('熔炉本轮：成员适配'))
  assert.ok(member.includes('把**当前成员**接到工作台'))
  assert.ok(!member.includes('按闸门政策'))
  assert.ok(node.includes('熔炉本轮：节点适配'))
  assert.ok(node.includes('把**当前步骤**接到工作台'))
  assert.ok(!node.includes('按闸门政策'))
  assert.ok(review.includes('熔炉本轮：系统审核'))
  assert.ok(review.includes('通过或拒绝'))
  assert.ok(!review.includes('ACW-ADAPT'))
  assert.ok(!review.includes('ACW_ADAPTER_EVENTS'))
})

test('activating one role writes ACTIVE.md without mixing memories', () => {
  const pack = activateFurnaceRole(FURNACE_ROLE.REVIEW, { sessionId: 's1' })
  const text = fs.readFileSync(pack.activeMd, 'utf8')
  assert.ok(text.includes('系统审核'))
  assert.equal(text.includes('把当前成员接到工作台'), false)
  const json = JSON.parse(fs.readFileSync(path.join(path.dirname(pack.activeMd), 'active.json'), 'utf8'))
  assert.equal(json.role, FURNACE_ROLE.REVIEW)
})

test('memory seed is copied once and not overwritten', () => {
  ensureFurnaceWorkspace()
  const file = path.join(furnaceMemoryDir(), 'review.md')
  fs.writeFileSync(file, '# 用户已写记忆\n', 'utf8')
  ensureFurnaceWorkspace()
  assert.equal(loadFurnaceMemory(FURNACE_ROLE.REVIEW), '# 用户已写记忆')
})

test('step adapt prefers node role over member role', () => {
  assert.equal(
    resolveAdaptFurnaceRole({ stepAdapt: true, memberAdapt: true }),
    FURNACE_ROLE.NODE_ADAPT,
  )
  assert.equal(
    resolveAdaptFurnaceRole({ stepAdapt: false, memberAdapt: true }),
    FURNACE_ROLE.MEMBER_ADAPT,
  )
  assert.equal(resolveAdaptFurnaceRole({}), null)
})

test('situation slots copy a node map not a single scenario', () => {
  const text = composeFurnaceSituation({
    intent: '先把数据拉下来再问我',
    groupTitle: '采集流水线',
    groupDescription: '任意场景都行',
    sessionTitle: '采集流水线',
    workFolder: '/tmp/job',
    agenda: [
      { title: '填参', kind: '人工', gateHuman: true, statusLabel: '完成' },
      {
        title: '拉数据',
        kind: '成员',
        member: '采集器',
        adapt: true,
        statusLabel: '执行中',
      },
      { title: '确认', kind: '人工', gateHuman: true, statusLabel: '待跑' },
    ],
    nowIndex: 1,
    now: {
      title: '拉数据',
      kind: '成员',
      member: '采集器',
      adapt: true,
      statusLabel: '执行中',
      prevOutput: '参数已齐',
    },
    params: [{ key: '#1', value: '项目A' }],
    announcementPath: 'journals/sessions/s1/ANNOUNCEMENT.md',
  })
  assert.ok(text.includes('节点一览'))
  assert.ok(text.includes('#2 [成员 · 采集器 · 适配] 拉数据 · 执行中 ← 现在'))
  assert.ok(text.includes('当前节点：#2 拉数据'))
  assert.ok(text.includes('勾了适配'))
  assert.ok(text.includes('上一节点产出：参数已齐'))
  assert.ok(text.includes('只处理当前节点'))
  const packed = composeFurnaceContext(FURNACE_ROLE.SESSION, {
    situation: { intent: '先问缺哪一步', groupTitle: '采集流水线' },
  })
  assert.ok(packed.includes('熔炉本轮：群聊主持'))
  assert.ok(packed.includes('节点一览'))
})

test('situation clips oversized intent', () => {
  const huge = '总结'.repeat(3000)
  const clipped = clipFurnaceText(huge, 20)
  assert.ok(clipped.includes('截断'))
  assert.ok(clipped.length < huge.length)
})

test('switching role keeps situation in ACTIVE.md', () => {
  const situation = { intent: '做工作总结', groupTitle: '周报工作总结' }
  activateFurnaceRole(FURNACE_ROLE.SESSION, { sessionId: 's2', situation })
  const pack = activateFurnaceRole(FURNACE_ROLE.REVIEW, { sessionId: 's2', situation })
  const text = fs.readFileSync(pack.activeMd, 'utf8')
  assert.ok(text.includes('熔炉本轮：系统审核'))
  assert.ok(text.includes('做工作总结'))
  assert.ok(fs.readFileSync(pack.situationMd, 'utf8').includes('做工作总结'))
})
