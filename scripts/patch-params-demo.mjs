import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const db = new Database(path.join(root, 'data/oh-my-co-work.sqlite'))
const now = new Date().toISOString()

const g = db.prepare('SELECT id, steps_json FROM groups LIMIT 1').get()
if (g) {
  const steps = JSON.parse(g.steps_json)
  if (steps[0] && steps[0].type === 'human') {
    steps[0].captureParams = true
    if (!/项目信息|参数/.test(steps[0].title || '')) {
      steps[0].title = '输入项目信息'
    }
    db.prepare('UPDATE groups SET steps_json=?, updated_at=? WHERE id=?').run(
      JSON.stringify(steps),
      now,
      g.id,
    )
    console.log('group step0', steps[0])
  }
}

const m = db.prepare("SELECT id, config_json FROM members WHERE name='echo'").get()
if (m) {
  const c = JSON.parse(m.config_json || '{}')
  c.defaultText = c.defaultText?.includes('#') ? c.defaultText : '收到项目参数 #1'
  c.demo = true
  db.prepare('UPDATE members SET config_json=?, updated_at=? WHERE id=?').run(
    JSON.stringify(c),
    now,
    m.id,
  )
  console.log('echo', c.defaultText)
}

const sc = db.prepare("SELECT id, config_json FROM members WHERE name='script_cmd'").get()
if (sc) {
  const c = JSON.parse(sc.config_json || '{}')
  const s = c.script || {}
  if (!String(s.command || '').includes('#')) {
    s.command = 'echo ECW-OK #1'
    c.script = s
    db.prepare('UPDATE members SET config_json=?, updated_at=? WHERE id=?').run(
      JSON.stringify(c),
      now,
      sc.id,
    )
    console.log('script', s.command)
  }
}

db.close()
console.log('patch OK')
