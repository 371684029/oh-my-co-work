import { previewHashValue } from './sessionContextUi.js'

export function buildHashComposerItems({
  groupCard = '',
  groupFolder = '',
  paramsList = [],
  nodes = [],
  maxParams = 99,
  wholeOutputText,
}) {
  const items = []
  items.push({
    key: '群聊',
    label: '群聊',
    name: '群聊名片',
    value: groupCard,
    preview: previewHashValue(groupCard),
    emptyHint: '开聊后写入群名片',
  })
  items.push({
    key: '文件夹',
    label: '文件夹',
    name: '工作文件夹',
    value: groupFolder,
    preview: previewHashValue(groupFolder),
    emptyHint: '未配置工作目录',
  })

  const list = paramsList.slice(0, maxParams)
  const shown = Math.min(maxParams, Math.max(list.length, 1))
  for (let n = 1; n <= shown; n++) {
    const text = list[n - 1] == null ? '' : String(list[n - 1])
    items.push({
      key: String(n),
      label: String(n),
      name: `输入·第${n}段`,
      value: text,
      preview: previewHashValue(text),
      emptyHint: n === 1 && !list.length ? '空格/换行分隔录入；最多 #99' : '空',
    })
  }

  let outIdx = 0
  for (const n of nodes) {
    const whole = typeof wholeOutputText === 'function' ? wholeOutputText(n.output) : ''
    if (!whole) continue
    outIdx += 1
    const title = n.title || `步骤 ${n.step_index + 1}`
    items.push({
      key: `出${outIdx}`,
      label: `出${outIdx}`,
      name: `输出·${title}`,
      value: whole,
      preview: previewHashValue(whole),
      emptyHint: '',
    })
  }
  return items
}

export function filterHashComposerItems(items, query, { maxParams = 99, paramsList = [] } = {}) {
  const q = String(query || '')
    .toLowerCase()
    .trim()
    .replace(/^#/, '')
  const filtered = !q
    ? items
    : items.filter(
        (h) =>
          h.key.toLowerCase().includes(q) ||
          h.label.toLowerCase().includes(q) ||
          h.name.toLowerCase().includes(q) ||
          String(h.value || '')
            .toLowerCase()
            .includes(q),
      )
  const n = Number(q)
  if (Number.isInteger(n) && n >= 1 && n <= maxParams) {
    if (!filtered.some((h) => h.key === String(n))) {
      const text = paramsList[n - 1] == null ? '' : String(paramsList[n - 1])
      return [
        ...filtered,
        {
          key: String(n),
          label: String(n),
          name: `输入·第${n}段`,
          value: text,
          preview: previewHashValue(text),
          emptyHint: '尚未写入',
        },
      ]
    }
  }
  return filtered
}
