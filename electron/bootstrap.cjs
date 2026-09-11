const { app, dialog } = require('electron')
const fs = require('fs')
const path = require('path')

function resolveRoot() {
  const fromArg = process.argv.find(
    (a, i) => i > 0 && a && !String(a).startsWith('-') && fs.existsSync(path.join(a, 'package.json')),
  )
  if (fromArg) return path.resolve(fromArg)
  return path.resolve(__dirname, '..')
}

function log(msg) {
  try {
    const root = resolveRoot()
    fs.mkdirSync(path.join(root, 'data'), { recursive: true })
    fs.appendFileSync(path.join(root, 'data', 'electron.log'), `[${new Date().toISOString()}] ${msg}\n`)
  } catch {
    /* ignore */
  }
}

process.on('uncaughtException', (err) => {
  log(`uncaughtException ${err && err.stack ? err.stack : err}`)
  try {
    dialog.showErrorBox('oh-my-co-work', String(err && err.message ? err.message : err))
  } catch {
    /* ignore */
  }
})

process.on('unhandledRejection', (err) => {
  log(`unhandledRejection ${err && err.stack ? err.stack : err}`)
})

log(`bootstrap argv=${JSON.stringify(process.argv)}`)

import('./main.js').catch((err) => {
  log(`import main.js failed ${err && err.stack ? err.stack : err}`)
  try {
    dialog.showErrorBox('oh-my-co-work', `无法加载主程序：${err && err.message ? err.message : err}`)
  } catch {
    /* ignore */
  }
  app.quit()
})
