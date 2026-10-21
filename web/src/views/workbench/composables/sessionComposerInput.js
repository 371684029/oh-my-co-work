/** 去掉末尾的 #快捷触发段（# / #xxx），可无前导空格 */
export function stripTrailingHashTrigger(text) {
  let s = String(text || '')
  for (let i = 0; i < 6; i++) {
    const next = s.replace(/\s*#[^\s#]*$/u, '').replace(/[ \t]+$/u, '')
    if (next === s) break
    s = next
  }
  return s
}

/** 纯文本 → XSender chatNode（按行拆 Write） */
export function textToChatNode(text) {
  const lines = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
  return lines.map((line) => [{ type: 'Write', text: line }])
}
