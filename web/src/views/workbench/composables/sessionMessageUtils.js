/** Pure session message helpers (FE-01 split from useSessionDetail.js). */

export function messageText(m) {
  const t = m?.content?.text
  if (t != null && String(t).length) return String(t)
  if (m?.content?.attachments?.length) return ''
  if (m?.content && typeof m.content === 'object' && !m.content.text) {
    return JSON.stringify(m.content)
  }
  return ''
}

export function formatSize(n) {
  const b = Number(n) || 0
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

export function fileIcon(f) {
  const mime = String(f?.mime || '')
  const name = String(f?.name || '')
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return '🖼'
  if (mime.includes('pdf') || /\.pdf$/i.test(name)) return '📄'
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return '📦'
  if (/\.(xlsx?|csv)$/i.test(name)) return '📊'
  if (/\.(docx?|txt|md)$/i.test(name)) return '📝'
  if (/\.(js|ts|py|json|vue|java|go)$/i.test(name)) return '💻'
  return '📎'
}

export function adapterChoices(m) {
  return Array.isArray(m?.content?.choices) ? m.content.choices.filter(Boolean) : []
}
