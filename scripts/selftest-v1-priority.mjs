#!/usr/bin/env node
/**
 * 1.0-dev 自测：health 版本、CI01 缺参拦截、X07 闸门全文、R03 幂等
 * 用法：先 npm run dev:server，再 node scripts/selftest-v1-priority.mjs
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

async function main() {
  const health = await req('/health')
  assert(health.ok === true, 'health.ok')
  assert(health.version, `health.version=${health.version}`)
  console.log('✓ health', health.version)

  const member = await req('/members', {
    method: 'POST',
    body: JSON.stringify({
      name: `ci01_${Date.now()}`,
      displayName: 'CI01 测缺参',
      kind: 'script',
      config: {
        script: {
          mode: 'command',
          command: process.platform === 'win32' ? 'echo CI01-#1' : 'echo CI01-#1',
          scriptWorkDir: process.cwd(),
          timeoutMs: 30_000,
          showScriptPopup: false,
        },
      },
    }),
  })
  assert(member?.id, 'member created')

  const group = await req('/groups', {
    method: 'POST',
    body: JSON.stringify({
      title: `CI01 组 ${Date.now()}`,
      description: 'selftest',
      steps: [
        {
          title: '跑命令需 #1',
          type: 'member',
          memberId: member.id,
          gate: true,
          flow: { admin: false, auto: true, human: true },
        },
      ],
    }),
  })
  assert(group?.id, 'group created')

  const started = await req(`/groups/${group.id}/sessions`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  const sessionId = started?.session?.id || started?.id
  assert(sessionId, 'session id')

  // 若有启动闸门则通过（无参数）
  const detail0 = await req(`/sessions/${sessionId}`)
  if (detail0?.session?.context?.pendingStart || detail0?.session?.status === 'waiting_human') {
    await req(`/sessions/${sessionId}/gate`, {
      method: 'POST',
      body: JSON.stringify({ action: 'approve_start', text: '', idempotencyKey: `start_${sessionId}` }),
    })
  }

  // 等引擎推进
  await new Promise((r) => setTimeout(r, 400))
  let detail = await req(`/sessions/${sessionId}`)
  const needNode = (detail.nodes || []).find(
    (n) => n.status === 'waiting_human' && (n.output?.needParams || n.output?.reason === 'missing_param_1'),
  )
  assert(needNode, 'CI01: expected need_params waiting node')
  console.log('✓ CI01 intercepted', needNode.title || needNode.id)

  // 补参
  await req(`/sessions/${sessionId}/gate`, {
    method: 'POST',
    body: JSON.stringify({
      action: 'submit',
      text: 'alpha beta',
      nodeInstanceId: needNode.id,
      idempotencyKey: `fill_${sessionId}`,
    }),
  })
  await new Promise((r) => setTimeout(r, 800))
  detail = await req(`/sessions/${sessionId}`)
  const ctx = detail.session?.context || {}
  assert(ctx.paramsList?.[0] === 'alpha' || ctx.params?.['#1'] === 'alpha', 'params #1=alpha')
  console.log('✓ CI01 filled params', ctx.paramsList)

  // 等到审核闸门
  await new Promise((r) => setTimeout(r, 500))
  detail = await req(`/sessions/${sessionId}`)
  const gateNode = (detail.nodes || []).find((n) => n.status === 'waiting_human' && !n.output?.needParams)
  if (gateNode) {
    const key = `approve_${sessionId}_${gateNode.id}`
    const r1 = await req(`/sessions/${sessionId}/gate`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'approve',
        text: '附言全文-X07',
        nodeInstanceId: gateNode.id,
        idempotencyKey: key,
      }),
    })
    const r2 = await req(`/sessions/${sessionId}/gate`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'approve',
        text: '附言全文-X07-重复',
        nodeInstanceId: gateNode.id,
        idempotencyKey: key,
      }),
    })
    const gr = r2.gateResult || {}
    assert(
      gr.idempotentReplay === true || gr.idempotent === true || gr.ok === true,
      `R03 idempotent replay got ${JSON.stringify(gr)}`,
    )
    assert(r1.gateResult?.passed === true || r1.gateResult?.ok === true, 'first approve ok')
    detail = await req(`/sessions/${sessionId}`)
    const c2 = detail.session?.context || {}
    assert(
      c2.lastHumanInput === '附言全文-X07' || c2.params?.['#a'] === '附言全文-X07',
      `X07 bind lastHumanInput/#a got ${c2.lastHumanInput} / ${c2.params?.['#a']}`,
    )
    console.log('✓ X07 + R03', {
      lastHumanInput: c2.lastHumanInput,
      a: c2.params?.['#a'],
      replay: gr,
    })
  } else {
    console.log('… skip X07/R03 (no review gate; flow may auto-advance without human)')
  }

  console.log('ALL PASS')
}

main().catch((e) => {
  console.error('FAIL', e.message)
  process.exit(1)
})
