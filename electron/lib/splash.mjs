export function splashHtml() {
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
  </style>
</head>
<body>
  <div class="box">
    <h1>oh-my-co-work</h1>
    <p>正在启动本机服务，请稍候…</p>
  </div>
</body>
</html>`
}

export function splashDataUrl() {
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(splashHtml())
}
