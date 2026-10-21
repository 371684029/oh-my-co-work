/** 去掉无信息量的入出文案 */
export function cleanAnnounceIo(text) {
  let t = String(text || '').trim()
  if (
    !t ||
    t === '（无）' ||
    t === '（空）' ||
    t === '（暂无实质产出）' ||
    t === '（无业务摘要）'
  ) {
    return ''
  }
  t = t
    .split(/\r?\n/)
    .filter((line) => {
      const s = line.trim()
      if (!s) return false
      if (/开始执行|已结束任务/.test(s) && s.length < 24) return false
      if (/^状态：等待/.test(s)) return false
      return true
    })
    .join('\n')
    .trim()
  return t
}

export function collectNodeHashParams(n) {
  const nodeHash = []
  const seen = new Set()
  const pushHash = (key, val) => {
    if (!key || seen.has(key)) return
    seen.add(key)
    nodeHash.push({ key, value: val == null ? '' : String(val) })
  }
  const ioParams = {
    ...(n.input?.params && typeof n.input.params === 'object' ? n.input.params : {}),
    ...(n.output?.params && typeof n.output.params === 'object' ? n.output.params : {}),
  }
  const ioList = Array.isArray(n.input?.paramsList)
    ? n.input.paramsList
    : Array.isArray(n.output?.paramsList)
      ? n.output.paramsList
      : []
  ioList.forEach((v, i) => pushHash(`#${i + 1}`, v))
  Object.keys(ioParams)
    .filter((k) => k.startsWith('#'))
    .sort((a, b) => {
      const na = /^#\d+$/.test(a) ? Number(a.slice(1)) : 9999
      const nb = /^#\d+$/.test(b) ? Number(b.slice(1)) : 9999
      if (na !== nb) return na - nb
      return a.localeCompare(b, 'zh')
    })
    .forEach((k) => pushHash(k, ioParams[k]))
  return nodeHash
}

/** Map one flow node to群报告 progress row. */
export function mapAnnounceProgressNode(n, { formatIo, statusLabel }) {
  const st = n.status || 'pending'
  let tagType = 'info'
  if (st === 'succeeded') tagType = 'success'
  else if (st === 'failed') tagType = 'danger'
  else if (st === 'waiting_human' || st === 'running') tagType = 'warning'

  const inText = cleanAnnounceIo(formatIo(n.input, 'input'))
  const outText = cleanAnnounceIo(formatIo(n.output, 'output'))
  const noteRaw =
    n.output && typeof n.output === 'object' && n.output.humanNote
      ? String(n.output.humanNote).trim()
      : ''
  const act =
    n.output?.humanAction === 'reject'
      ? '拒绝'
      : n.output?.humanAction === 'approve'
        ? '通过'
        : n.output?.humanAction === 'pending' || st === 'waiting_human'
          ? 'pending'
          : ''
  const note = noteRaw ? (act ? `${act}：${noteRaw}` : noteRaw) : ''

  let pendingHint = ''
  if (st === 'pending' || st === 'not_run') pendingHint = '待跑'
  else if (st === 'running') pendingHint = '执行中…'
  else if (st === 'waiting_human' && !outText && !note) pendingHint = '待确认'

  return {
    id: n.id,
    idx: Number(n.step_index) + 1,
    title: n.title || `步骤 ${Number(n.step_index) + 1}`,
    statusLabel: statusLabel(st) || st,
    tagType,
    nodeHash: collectNodeHashParams(n),
    inText,
    outText,
    note,
    pendingHint,
  }
}
