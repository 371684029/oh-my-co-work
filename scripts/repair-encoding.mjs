/**
 * 修复被写成 ??? 的中文标题（group / member / session / node / message）
 */
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '../data/oh-my-co-work.sqlite')
const db = new Database(dbPath)
const now = new Date().toISOString()

const steps = JSON.stringify([
  { id: 'step_0', title: '输入任务说明', type: 'human', memberId: null, gate: false },
  {
    id: 'step_1',
    title: '示例回声',
    type: 'member',
    memberId: 'mem_mrncuma1_135vr19',
    gate: true,
  },
  {
    id: 'step_2',
    title: '跑一段命令',
    type: 'member',
    memberId: 'mem_mrncuma1_5d9k831',
    gate: true,
  },
])

db.prepare(
  'UPDATE groups SET title=?, description=?, steps_json=?, updated_at=? WHERE id=?',
).run(
  '演示流',
  'MVP 演示：人工输入 → 回声+闸门 → 命令',
  steps,
  now,
  'grp_mrncuma1_grev3d2',
)

const adminCfg = JSON.stringify({
  role: 'admin',
  defaultText:
    '【统一管理员】收到。我是本机协同台的管理员 Agent，可协助调度、核对流程与本机事项（完全本地）。',
})
db.prepare(
  'UPDATE members SET display_name=?, config_json=?, updated_at=? WHERE name=?',
).run('统一管理员', adminCfg, now, 'unified_admin')

const sessions = db.prepare('SELECT id, title FROM sessions').all()
const updS = db.prepare('UPDATE sessions SET title=?, updated_at=? WHERE id=?')
for (const s of sessions) {
  if (!s.title.includes('?')) continue
  const parts = s.title.split('·')
  const rest = parts.length > 1 ? parts.slice(1).join('·').trim() : ''
  const title = rest ? `演示流 · ${rest}` : '演示流'
  updS.run(title, now, s.id)
  console.log('session', s.id, '->', title)
}

const nodes = db.prepare('SELECT id, title, step_index FROM node_instances').all()
const updN = db.prepare('UPDATE node_instances SET title=? WHERE id=?')
const stepTitles = ['输入任务说明', '示例回声', '跑一段命令']
for (const n of nodes) {
  if (!n.title || !n.title.includes('?')) continue
  const t = stepTitles[n.step_index] || `步骤 ${n.step_index + 1}`
  updN.run(t, n.id)
  console.log('node', n.id, n.title, '->', t)
}

const msgs = db.prepare('SELECT id, content_json FROM messages').all()
const updM = db.prepare('UPDATE messages SET content_json=? WHERE id=?')
let mc = 0
for (const m of msgs) {
  try {
    const c = JSON.parse(m.content_json || '{}')
    let ch = false
    if (typeof c.text === 'string' && c.text.includes('?')) {
      let t = c.text
        .replace(/使用模板「\?+」/g, '使用模板「演示流」')
        .replace(/模板「\?+」/g, '模板「演示流」')
      if (/^\?+$/.test(t.trim())) t = '请输入任务说明'
      if (t !== c.text) {
        c.text = t
        ch = true
      }
    }
    if (ch) {
      updM.run(JSON.stringify(c), m.id)
      mc++
    }
  } catch {
    /* ignore */
  }
}
console.log('messages fixed', mc)
console.log('group', db.prepare('SELECT title, description FROM groups').get())
console.log(
  'admin',
  db.prepare("SELECT display_name FROM members WHERE name='unified_admin'").get(),
)
db.close()
console.log('repair OK')
