/**
 * 自测：会话创建 / 重命名 / 删除 / 归档 / 中文标题
 */
const BASE = process.env.ACW_API || 'http://127.0.0.1:3780/api'

async function req(path, opt = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opt.headers || {}) },
    ...opt,
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: res.status, ok: res.ok, data }
}

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg)
  console.log('  OK', msg)
}

async function main() {
  console.log('== health ==')
  const h = await req('/health')
  assert(h.ok, `health ${h.status}`)

  console.log('== groups (中文) ==')
  const groups = await req('/groups')
  assert(Array.isArray(groups.data) && groups.data.length > 0, '有群模板')
  const g =
    groups.data.find((x) => String(x.title || '').includes('演示流')) ||
    groups.data.find((x) => String(x.title || '').includes('演示')) ||
    groups.data[0]
  assert(g.title && !g.title.includes('?'), `群标题正常: ${g.title}`)

  console.log('== members (中文) ==')
  const members = await req('/members')
  const admin = members.data?.find((m) => m.name === 'unified_admin')
  assert(admin && admin.display_name === '统一管理员', `管理员: ${admin?.display_name}`)

  console.log('== create session ==')
  const created = await req(`/groups/${g.id}/sessions`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  assert(created.status === 201 || created.ok, `创建 status ${created.status}`)
  const sid = created.data.id
  assert(sid, `session id ${sid}`)
  assert(
    created.data.title &&
      (/[\u4e00-\u9fff]/.test(created.data.title) || created.data.title.includes('演示')),
    `标题含中文: ${created.data.title}`,
  )

  console.log('== rename ==')
  const newTitle = `自测会话 ${Date.now()}`
  const ren = await req(`/sessions/${sid}`, {
    method: 'PATCH',
    body: JSON.stringify({ title: newTitle }),
  })
  assert(ren.ok && ren.data.title === newTitle, `重命名为 ${ren.data?.title}`)

  console.log('== get detail ==')
  const detail = await req(`/sessions/${sid}`)
  assert(detail.ok && detail.data.session.id === sid, '详情可取')
  assert(Array.isArray(detail.data.messages), '有 messages')
  assert(Array.isArray(detail.data.nodes), '有 nodes')

  console.log('== delete ==')
  const del = await req(`/sessions/${sid}`, { method: 'DELETE' })
  assert(del.status === 204, `删除 204 got ${del.status}`)
  const list = await req('/sessions')
  assert(!list.data.some((s) => s.id === sid), '列表中已无该会话')

  console.log('== delete 不存在 ==')
  const del2 = await req(`/sessions/${sid}`, { method: 'DELETE' })
  // 当前实现幂等 204
  assert(del2.status === 204 || del2.status === 404, `二次删除 status ${del2.status}`)

  console.log('== archive flow ==')
  const c2 = await req(`/groups/${g.id}/sessions`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  const sid2 = c2.data.id
  const arch = await req(`/sessions/${sid2}/archive`, {
    method: 'POST',
    body: '{}',
  })
  assert(arch.ok && arch.data.status === 'archived', `归档 ${arch.data?.status}`)
  await req(`/sessions/${sid2}`, { method: 'DELETE' })

  console.log('\nALL SELFTESTS PASSED')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
