import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 源码在 electron/lib/，打包后被 esbuild 合进 electron/main.js，两处都要能找到图标
const ICON_CANDIDATES = [path.join(__dirname, '../icon.png'), path.join(__dirname, 'icon.png')]

function logoDataUri() {
  for (const p of ICON_CANDIDATES) {
    try {
      return 'data:image/png;base64,' + fs.readFileSync(p).toString('base64')
    } catch {
      /* try next */
    }
  }
  return ''
}

export function splashHtml(statusText = '正在启动本机服务，请稍候…') {
  const logo = logoDataUri()
  const img = logo
    ? `<img src="${logo}" width="72" height="72" alt="oh-my-co-work" style="display:block;margin:0 auto 14px;border-radius:16px" />`
    : ''
  const status = String(statusText || '').replace(/[<>&]/g, '')
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>oh-my-co-work</title>
  <style>
    html, body { height: 100%; margin: 0; }
    body {
      display: flex; align-items: center; justify-content: center;
      font-family: "Segoe UI", "PingFang SC", sans-serif;
      background: #f4f7fb; color: #303133;
    }
    .box { text-align: center; }
    h1 { font-size: 22px; font-weight: 600; margin: 0 0 8px; }
    p { margin: 0; color: #909399; }
    .progress { margin-top: 16px; height: 4px; background: #e4e7ed; border-radius: 2px; overflow: hidden; }
    .progress i { display: block; height: 100%; width: 35%; background: #409eff; animation: ind 1.2s ease-in-out infinite; }
    @keyframes ind { 0% { transform: translateX(-100%); } 100% { transform: translateX(320%); } }
  </style>
</head>
<body>
  <div class="box">
    ${img}
    <h1>oh-my-co-work</h1>
    <p id="status">${status}</p>
    <div class="progress" aria-hidden="true"><i></i></div>
  </div>
</body>
</html>`
}

export function splashDataUrl(statusText) {
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(splashHtml(statusText))
}

export async function setSplashStatus(webContents, statusText) {
  if (!webContents || webContents.isDestroyed()) return
  const msg = String(statusText || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  try {
    await webContents.executeJavaScript(
      `(() => { const el = document.getElementById('status'); if (el) el.textContent = '${msg}'; })()`,
    )
  } catch {
    /* ignore */
  }
}
