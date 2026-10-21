/** 审核三态：pending | approve | reject */
export function reviewAction(n) {
  const a = n?.output?.humanAction
  if (a === 'approve' || a === 'reject' || a === 'pending') return a
  if (n?.status === 'waiting_human') return 'pending'
  return ''
}

export function reviewLabel(n) {
  const a = reviewAction(n)
  if (a === 'approve') return '通过'
  if (a === 'reject') return '拒绝'
  if (a === 'pending') return 'pending'
  return ''
}
