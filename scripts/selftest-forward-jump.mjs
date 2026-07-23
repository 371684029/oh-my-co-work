#!/usr/bin/env node
/**
 * 回归：往前跳不克隆 + 旧待确认标已绕过；往回/再跑仍克隆
 * 用法：npm run dev:server && node scripts/selftest-forward-jump.mjs
 */
const BASE = process.env.ACW_BASE || 'http://127.0.0.1:3780/api'

async function req(path, opts = {}) {
  const r = await fetch(`${BASE}${path}`, {
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  })
  const text = await r.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!r.ok) {
    const err = new Error(body?.error || text || r.statusText)
    err.status = r.status
    err.body = body
    throw err
  }
  return body
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function waitFor(fn, { tries = 40, ms = 150 } = {}) {
  let last
  for (let i = 0; i < tries; i++) {
    last = await fn()
    if (last) return last
    await new Promise((r) => setTimeout(r, ms))
  }
  return last
}

async function main() {
  const health = await req('/health')
  assert(health.ok === true, 'health.ok')
  console.log('✓ health', health.version)

  const echo = await req('/members', {
    method: 'POST',
    body: JSON.stringify({
      name: `fwd_${Date.now()}`,
      displayName: '前进跳测',
      kind: 'echo',
      config: { defaultText: 'ok #1', requiresParams: false, skipParamsCheck: true },
    }),
  })
  assert(echo?.id, 'member')

  const group = await req('/groups', {
    method: 'POST',
    body: JSON.stringify({
      title: `前进跳 ${Date.now()}`,
      description: 'selftest-forward-jump',
      steps: [
        {
          title: '第一步',
          type: 'member',
          memberId: echo.id,
          gate: true,
          flow: { admin: false, auto: true, human: true },
        },
        {
          title: '第二步',
          type: 'member',
          memberId: echo.id,
          gate: true,
          flow: { admin: false, auto: true, human: true },
        },
        {
          title: '第三步',
          type: 'member',
          memberId: echo.id,
          gate: true,
          flow: { admin: false, auto: true, human: true },
        },
      ],
    }),
  })
  assert(group?.id, 'group')

  const started = await req(`/groups/${group.id}/sessions`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  const sessionId = started?.session?.id || started?.id
  assert(sessionId, 'sessionId')

  const detail0 = await req(`/sessions/${sessionId}`)
  if (detail0?.session?.context?.pendingStart || detail0?.session?.status === 'waiting_human') {
    await req(`/sessions/${sessionId}/gate`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'approve_start',
        text: 'go',
        idempotencyKey: `start_${sessionId}`,
      }),
    })
  }

  const waitNode1 = await waitFor(async () => {
    const d = await req(`/sessions/${sessionId}`)
    return (d.nodes || []).find(
      (n) => n.title === '第一步' && n.status === 'waiting_human' && !n.output?.cloned,
    )
  })
  assert(waitNode1, 'step1 waiting_human')
  console.log('✓ step1 waiting', waitNode1.id)

  let detail = await req(`/sessions/${sessionId}`)
  const beforeLen = (detail.nodes || []).filter((n) => n.step_type !== 'archive').length
  const step3 = (detail.nodes || []).find((n) => n.title === '第三步' && !n.output?.cloned)
  assert(step3 && step3.status === 'pending', `step3 pending got ${step3?.status}`)

  const fwd = await req(`/sessions/${sessionId}/restart-from-node`, {
    method: 'POST',
    body: JSON.stringify({ nodeInstanceId: step3.id, stepIndex: step3.step_index }),
  })
  assert(fwd.forwardJump === true, `expected forwardJump got ${JSON.stringify(fwd)}`)
  assert(fwd.cloned === false, 'forward must not clone')
  console.log('✓ forwardJump api', fwd.stepIndex)

  await new Promise((r) => setTimeout(r, 400))
  detail = await req(`/sessions/${sessionId}`)
  const afterLen = (detail.nodes || []).filter((n) => n.step_type !== 'archive').length
  assert(afterLen === beforeLen, `node count changed ${beforeLen} -> ${afterLen}`)

  const abandoned = (detail.nodes || []).find((n) => n.id === waitNode1.id)
  assert(abandoned?.status === 'skipped', `abandoned status=${abandoned?.status}`)
  assert(abandoned?.output?.bypassed === true, 'abandoned bypassed flag')
  console.log('✓ abandoned bypassed')

  const step2 = (detail.nodes || []).find((n) => n.title === '第二步' && !n.output?.cloned)
  assert(step2?.status === 'skipped' && step2?.output?.bypassed, `step2 ${step2?.status}`)

  const cur = detail.session.current_step_index
  assert(Number(cur) === Number(step3.step_index), `cursor ${cur} vs ${step3.step_index}`)

  const liveWait = await waitFor(async () => {
    const d = await req(`/sessions/${sessionId}`)
    return (d.nodes || []).find(
      (n) => n.id === step3.id && (n.status === 'waiting_human' || n.status === 'running'),
    )
  })
  assert(liveWait, 'step3 became active after forward jump')
  console.log('✓ step3 active', liveWait.status)

  // 往回：从第一步再跑 → 应克隆
  const back = await req(`/sessions/${sessionId}/restart-from-node`, {
    method: 'POST',
    body: JSON.stringify({ nodeInstanceId: waitNode1.id, stepIndex: waitNode1.step_index }),
  })
  assert(back.cloned === true, `expected clone got ${JSON.stringify(back)}`)
  assert(back.forwardJump !== true, 'back must not be forwardJump')
  await new Promise((r) => setTimeout(r, 400))
  detail = await req(`/sessions/${sessionId}`)
  const clones = (detail.nodes || []).filter((n) => n.output?.cloned || n.input?.cloned)
  assert(clones.length >= 3, `expected >=3 clones got ${clones.length}`)
  console.log('✓ clone on rewind', clones.length)

  console.log('ALL PASS')
}

main().catch((e) => {
  console.error('FAIL', e.message)
  process.exit(1)
})
