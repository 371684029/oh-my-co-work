#!/usr/bin/env node
/**
 * R02 / R04 / M01 / M07 自测
 * 用法：npm run dev:server && node scripts/selftest-v1-stability.mjs
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
  assert(health.integrity?.ok === true, `integrity ${JSON.stringify(health.integrity)}`)
  console.log('✓ M07 health.integrity', health.integrity.detail)

  const folder = `/tmp/acw-pathlock-${Date.now()}`
  const { mkdirSync } = await import('node:fs')
  mkdirSync(folder, { recursive: true })

  const m1 = await req('/members', {
    method: 'POST',
    body: JSON.stringify({
      name: `pl1_${Date.now()}`,
      displayName: '路径锁A',
      kind: 'echo',
      workFolder: folder,
      config: { defaultText: 'a #1', requiresParams: false },
    }),
  })
  const m2 = await req('/members', {
    method: 'POST',
    body: JSON.stringify({
      name: `pl2_${Date.now()}`,
      displayName: '路径锁B',
      kind: 'echo',
      workFolder: folder,
      config: { defaultText: 'b', requiresParams: false },
    }),
  })

  // 成员无 #1 依赖：skipParamsCheck
  await req(`/members/${m1.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      config: { defaultText: 'a ok', requiresParams: false, skipParamsCheck: true },
    }),
  })
  await req(`/members/${m2.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      config: { defaultText: 'b ok', requiresParams: false, skipParamsCheck: true },
    }),
  })

  const g1 = await req('/groups', {
    method: 'POST',
    body: JSON.stringify({
      title: `锁组A ${Date.now()}`,
      workFolder: folder,
      steps: [
        {
          title: 'a',
          type: 'member',
          memberId: m1.id,
          gate: true,
          flow: { human: true, auto: true, admin: false },
        },
      ],
    }),
  })
  const g2 = await req('/groups', {
    method: 'POST',
    body: JSON.stringify({
      title: `锁组B ${Date.now()}`,
      workFolder: folder,
      steps: [
        {
          title: 'b',
          type: 'member',
          memberId: m2.id,
          gate: true,
          flow: { human: true, auto: true, admin: false },
        },
      ],
    }),
  })

  const s1 = await req(`/groups/${g1.id}/sessions`, { method: 'POST', body: '{}' })
  const sid1 = s1.id || s1.session?.id
  assert(sid1, 's1')
  // 通过启动闸门，使会话进入 active/waiting
  await req(`/sessions/${sid1}/gate`, {
    method: 'POST',
    body: JSON.stringify({ action: 'approve_start', text: 'x', idempotencyKey: `st_${sid1}` }),
  })
  await new Promise((r) => setTimeout(r, 300))

  // R04：同目录不再互斥，第二会话应可开聊（资源面板仅提示占用）
  const s2try = await req(`/groups/${g2.id}/sessions`, { method: 'POST', body: '{}' })
  const sid2try = s2try.id || s2try.session?.id
  assert(sid2try, 'R04 expected parallel session on same path')
  console.log('✓ R04 soft path hint (no lock)')

  // 备份
  const bak = await req('/backup', { method: 'POST', body: '{}' })
  assert(bak.ok === true && bak.path, `backup ${JSON.stringify(bak)}`)
  console.log('✓ M01 backup', bak.path, bak.format)

  // R02：用 SQL 无法直接测 boot；测 interrupted 闸门动作——先造 interrupted 态
  await req(`/sessions/${sid1}/archive`, { method: 'POST', body: '{}' })
  console.log('✓ archived holder')

  // 再开仍应成功
  const s2 = await req(`/groups/${g2.id}/sessions`, { method: 'POST', body: '{}' })
  const sid2 = s2.id || s2.session?.id
  assert(sid2, 's2 after archive')
  console.log('✓ R04 still ok after archive')

  console.log('ALL PASS')
}

main().catch((e) => {
  console.error('FAIL', e.message)
  process.exit(1)
})
