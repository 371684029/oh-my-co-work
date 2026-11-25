import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-mention-params-'))
process.env.ACW_DATA_ROOT = dataRoot

const { initDb, getDb } = await import('../src/db.js')
initDb()
const { createMember, createGroup, createSessionFromGroup } = await import('../src/services.js')
const { recordUserChatInput } = await import('../src/engine/userInput.js')
const { MEMBER_KIND, SYSTEM_PARAM_KEYS } = await import('@acw/shared')

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

test('临时协助 @ 不冲掉「下一步」写入的绑定槽', async () => {
  const member = createMember({
    name: `echo-mention-${Date.now()}`,
    displayName: '回声协助',
    kind: MEMBER_KIND.ECHO,
    workFolder: process.cwd(),
    config: { defaultText: 'ok' },
  })
  const group = createGroup({
    title: 'mention-params',
    workFolder: process.cwd(),
    config: { paramBindSlots: ['#3', '#4'] },
    steps: [{ type: 'human', title: '参数' }],
  })
  const session = createSessionFromGroup(group.id)
  const sessionId = session.id
  const ctx = {
    params: {
      '#1': '需求A',
      '#2': 'branch',
      '#3': '2',
      '#4': 'yes',
      [SYSTEM_PARAM_KEYS.GROUP_CARD]: 'card',
    },
    paramsList: ['需求A', 'branch'],
  }
  getDb()
    .prepare('UPDATE sessions SET context_json = ? WHERE id = ?')
    .run(JSON.stringify(ctx), sessionId)

  recordUserChatInput(sessionId, `@${member.display_name} 只看当前格`, {
    mentionAssist: true,
    callArgs: '只看当前格',
    actionLabel: '临时协助',
  })

  await wait(20)
  const row = getDb().prepare('SELECT context_json FROM sessions WHERE id = ?').get(sessionId)
  const next = JSON.parse(row.context_json)
  assert.equal(next.params['#1'], '需求A')
  assert.equal(next.params['#3'], '2')
  assert.equal(next.params['#4'], 'yes')
  assert.equal(next.params[SYSTEM_PARAM_KEYS.CALL_ARGS], '只看当前格')
  assert.notEqual(next.paramsList?.[0], '@')
})