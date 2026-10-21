/**
 * Single-document export (5.2.0 DOC-09).
 */

export function buildDocExportHtml({ title, bodyHtml, proseCss = '' }) {
  const safeTitle = String(title || '文档').replace(/[<>]/g, '')
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<style>
${proseCss}
body { margin: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
@media print { body { margin: 12mm; } }
</style>
</head>
<body>
<article class="doc-prose">${bodyHtml || ''}</article>
</body>
</html>`
}

export function downloadTextFile(filename, text, mime = 'text/html;charset=utf-8') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function openDocPrintWindow(html) {
  const w = window.open('', '_blank', 'noopener')
  if (!w) return false
  w.document.open()
  w.document.write(html)
  w.document.close()
  w.focus()
  w.print()
  return true
}
