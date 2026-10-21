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
