import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-template-pack-'))
process.env.ACW_DATA_ROOT = dataRoot

const { initDb } = await import('../src/db.js')
const {
  exportMemberTemplate,
  exportGroupTemplate,
  importTemplatePack,
  parametrizePaths,
  resolveTemplateVars,
} = await import('../src/templatePack.js')
const { createMember, createGroup, getMember, getGroup } = await import('../src/services.js')

initDb()

test('resolveTemplateVars substitutes workspace and home', () => {
  assert.equal(
    resolveTemplateVars('{{WORKSPACE}}/x', { workspace: '/tmp/ws' }),
    '/tmp/ws/x',
  )
  assert.equal(resolveTemplateVars('{{home}}/y', { home: '/home/u' }), '/home/u/y')
})

test('parametrizePaths replaces absolute paths', () => {
  assert.equal(parametrizePaths('D:\\work\\a'), '{{WORKSPACE}}')
  assert.equal(parametrizePaths('/home/u/proj'), '{{WORKSPACE}}')
  assert.equal(parametrizePaths('relative/inbox/x'), 'relative/inbox/x')
})

test('member template round-trip import', () => {
  const m = createMember({
    name: 'tpl_echo',
    displayName: '模板回声',
    kind: 'echo',
    workFolder: 'C:\\demo\\wf',
    config: { description: 'test' },
  })
  const pack = exportMemberTemplate(m.id)
  assert.equal(pack.kind, 'member')
  assert.equal(pack.member.workFolder, '{{WORKSPACE}}')
  const out = importTemplatePack(pack, { onConflict: 'rename' })
  assert.ok(out.primaryId)
  const imported = getMember(out.primaryId)
  assert.equal(imported.work_folder, '{{WORKSPACE}}')
})

test('group template bundles referenced members', () => {
  const mem = createMember({ name: 'step_bot', displayName: '步进', kind: 'echo' })
  const g = createGroup({
    title: '导出群',
    steps: [{ title: '跑', type: 'member', memberId: mem.id }],
  })
  const pack = exportGroupTemplate(g.id)
  assert.equal(pack.members.length, 1)
  assert.equal(pack.members[0].sourceMemberId, mem.id)
  const out = importTemplatePack(pack, { onConflict: 'rename' })
  const grp = getGroup(out.primaryId)
  assert.ok(grp.steps[0].memberId)
  assert.notEqual(grp.steps[0].memberId, mem.id)
  assert.ok(getMember(grp.steps[0].memberId))
})

test('overwrite member keeps id and merges config keys', () => {
  const m = createMember({
    name: 'ow_member',
    displayName: '原名',
    kind: 'echo',
    workFolder: 'C:\\old',
    config: { keepMe: 1, replaceMe: 'old' },
  })
  const pack = {
    acwTemplatePack: 1,
    kind: 'member',
    member: {
      name: 'ow_member',
      displayName: '新名',
      kind: 'echo',
      config: { replaceMe: 'new', extra: true },
    },
  }
  const out = importTemplatePack(pack, { onConflict: 'overwrite' })
  assert.equal(out.primaryId, m.id)
  const row = getMember(m.id)
  assert.equal(row.display_name, '新名')
  assert.equal(row.config.keepMe, 1)
  assert.equal(row.config.replaceMe, 'new')
  assert.equal(row.config.extra, true)
})

test('overwrite member leaves unspecified fields untouched', () => {
  const m = createMember({
    name: 'ow_partial',
    displayName: '保留显示名',
    kind: 'echo',
    workFolder: 'C:\\keep',
    config: { a: 1 },
  })
  const pack = {
    acwTemplatePack: 1,
    kind: 'member',
    member: { name: 'ow_partial', config: { b: 2 } },
  }
  importTemplatePack(pack, { onConflict: 'overwrite' })
  const row = getMember(m.id)
  assert.equal(row.display_name, '保留显示名')
  assert.equal(row.work_folder, 'C:\\keep')
  assert.equal(row.config.a, 1)
  assert.equal(row.config.b, 2)
})

test('overwrite group keeps id and updates steps in place', () => {
  const mem = createMember({ name: 'ow_step_mem', displayName: '步', kind: 'echo' })
  const g = createGroup({
    title: 'ow_group',
    description: '旧描述',
    steps: [{ title: '旧步', type: 'member', memberId: mem.id }],
  })
  const pack = {
    acwTemplatePack: 1,
    kind: 'group',
    group: {
      title: 'ow_group',
      description: '新描述',
      members: [{ ...exportMemberTemplate(mem.id).member, sourceMemberId: mem.id }],
      steps: [{ title: '新步', type: 'member', memberId: mem.id }],
    },
  }
  const out = importTemplatePack(pack, { onConflict: 'overwrite' })
  assert.equal(out.primaryId, g.id)
  const row = getGroup(g.id)
  assert.equal(row.description, '新描述')
  assert.equal(row.steps.length, 1)
  assert.equal(row.steps[0].title, '新步')
  // 包内 sourceMemberId 被重映射到既有成员 id
  assert.equal(row.steps[0].memberId, mem.id)
})

test('overwrite is idempotent across repeated imports', () => {
  createMember({ name: 'ow_idem', displayName: 'A', kind: 'echo', config: { n: 0 } })
  const pack = {
    acwTemplatePack: 1,
    kind: 'member',
    member: { name: 'ow_idem', displayName: 'B', config: { n: 1 } },
  }
  const first = importTemplatePack(pack, { onConflict: 'overwrite' })
  const second = importTemplatePack(pack, { onConflict: 'overwrite' })
  assert.equal(first.primaryId, second.primaryId)
  assert.equal(getMember(first.primaryId).display_name, 'B')
  assert.equal(getMember(first.primaryId).config.n, 1)
})
