import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-skip-'))
process.env.ACW_DATA_ROOT = dataRoot

const { initDb } = await import('../src/db.js')
initDb()
const { createMember, createGroup, createSessionFromGroup, getSessionDetail, handleGateAction } =
  await import('../src/services.js')
const { MEMBER_KIND, SESSION_STATUS } = await import('@acw/shared')

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function poll(fn, times = 40) {
  for (let i = 0; i < times; i++) {
    const out = await fn()
    if (out) return out
    await wait(25)
  }
  return null
}

test('skipWhen skips member step when param matches', async () => {
  const member = createMember({
    name: `echo-skip-${Date.now()}`,
    displayName: 'Echo',
    kind: MEMBER_KIND.ECHO,
    workFolder: process.cwd(),
    config: { defaultText: 'ran' },
  })
  const group = createGroup({
    title: 'Skip group',
    workFolder: process.cwd(),
    config: { paramSpecs: [{ key: '#1', required: false }] },
    steps: [
      { title: '跳过步', type: 'member', memberId: member.id, gate: false, flow: { admin: false, auto: false, human: false }, skipWhen: { param: '#1', value: 'skip' } },
      { title: '执行步', type: 'member', memberId: member.id, gate: false, flow: { admin: false, auto: false, human: false } },
    ],
  })
  const session = createSessionFromGroup(group.id)
  await handleGateAction(session.id, { action: 'approve_start', text: 'skip' })
  const d = await poll(async () => {
    const detail = getSessionDetail(session.id)
    return detail.session.status === SESSION_STATUS.ARCHIVED ? detail : null
  })
  assert.equal(d.nodes[0].status, 'skipped')
  assert.equal(d.nodes[1].status, 'succeeded')
})
