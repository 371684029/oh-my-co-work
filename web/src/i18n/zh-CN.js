/**
 * I18N-01: user-visible strings (Chinese primary; extend with en-US later).
 */
export const strings = {
  a11y: {
    skipToMain: '跳到主内容',
    settingsNav: '设置导航',
    sessionRail: '会话列表',
    sessionList: '会话条目',
    startChat: '开聊',
    flowRail: '流程与文档侧栏',
    flowRailTabs: '右栏视图',
    flowTab: '流程步骤',
    timelineTab: '时间线',
    docsTab: '文档中心',
    workbenchMain: '会话主区域',
    composer: '消息输入区',
    commandPaletteSearch: '命令面板搜索',
    commandPaletteList: '命令列表',
  },
  furnace: {
    idle: '闲置',
    working: '工作中',
    waiting: '等人',
    open: '开熔炉',
    peek: '展开',
    minimize: '收起',
  },
  desktop: {
    openDetachedWindow: '在新窗口打开会话',
  },
}

export function t(key) {
  const parts = String(key || '').split('.')
  let cur = strings
  for (const p of parts) {
    cur = cur?.[p]
    if (cur == null) return key
  }
  return typeof cur === 'string' ? cur : key
}
