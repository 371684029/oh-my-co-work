/** Composer placeholder when a gate message is pending. */
export function composerPlaceholderForGate(g) {
  if (!g) return '发消息… @成员 · #参数 · @节点重跑'
  const mode = g.content?.mode
  if (mode === 'session_start') {
    if (g.content?.callArgs || g.content?.captureParams === false) {
      return '可选参数全文作 #a；点「通过」启动…'
    }
    return g.content?.captureParams
      ? '可先输入说明/参数，再点「通过」启动…'
      : '可先输入说明，再点「通过」启动…'
  }
  if (mode === 'human_input' || mode === 'need_params') {
    return g.content?.captureParams || mode === 'need_params'
      ? '在此输入参数（空格/换行分段 → #1 #2…），Enter 或点「提交」'
      : '在此输入内容，Enter 或点「提交」'
  }
  if (mode === 'adapter_question') {
    return '工具在问你：可点选项，或先输入再提交'
  }
  if (mode === 'interrupted') {
    return '服务曾中断：继续=从中断处恢复 · 放弃=跳过未完成步骤（进程到设置里释放）'
  }
  const gateTitle = g.content?.text || g.content?.title
  return gateTitle ? `${gateTitle} · 可先写意见，再点「同意」或「拒绝」` : '可先写意见，再点「同意」或「拒绝」…'
}

export function composerToolbarHintForGate(gate) {
  if (gate) {
    const mode = gate.content?.mode
    if (mode === 'human_input' || mode === 'need_params') return '下方输入 · Enter 提交'
    if (mode === 'session_start') return 'Enter=发消息 · 点「通过」启动'
    if (mode === 'interrupted') return '点「继续」或「放弃」'
    if (mode === 'adapter_question') return '点选项或提交回答工具'
    return 'Enter=附言 · 点同意/拒绝定局'
  }
  return '@ 成员/节点 · # 参数 · / 指令 · Enter 发送'
}

export function showComposerHintIForGate(gate) {
  if (!gate) return true
  const mode = gate.content?.mode
  return ['session_start', 'human_input', 'need_params', 'adapter_question', 'interrupted'].includes(
    mode,
  )
}

export function composerFooterHintForGate(gate) {
  if (gate) {
    return '待确认与消息共用下方输入框 · 附言会记入群报告'
  }
  return '# 插入正文（群聊/文件夹/参数/输出）· @成员协助 · 发送会写入 # 与群报告'
}
