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
    shortcutsPage: '斜杠指令与快捷键',
    shortcutsBuiltinHotkeys: '内置快捷键说明',
    settingsSideNav: '设置导航',
    settingsProjectMenu: '项目设置菜单',
    settingsMetaMenu: '其它设置菜单',
    settingsMain: '设置主内容',
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
  settings: {
    members: '成员管理',
    groups: '群聊模板',
    shortcuts: '斜杠 / 快捷键',
    snippets: '提示词片段',
    wizard: '首次向导',
    prefs: '设置',
    restore: '还原中心',
    grok: 'Grok Build 教程',
    support: '支持与交流',
    about: '关于与更新',
    projectSection: '项目',
    metaSection: '其它',
  },
  docs: {
    colTitleGroup: '群模板',
    colTitleTime: '时间跨度',
    exportAll: '导出全部',
    allGroups: '全部群模板',
    searchPlaceholder: '全文搜索…',
    refresh: '刷新',
    pinned: '已固定',
    recent: '最近打开',
    outline: '目录',
    goWorkbench: '去工作台开聊',
    loadingFile: '正在加载文档内容…',
    noGroups: '暂无群模板',
    noDocsInRange: '该时间段暂无文档',
    noSessionDocs: '暂无会话文档',
    exportGroupShort: '导出',
    a11y: {
      exportAll: '导出全部文档',
      allGroups: '查看全部群模板文档',
      outline: '文档目录',
      exportGroup: '导出群模板 {title} 的全部文档',
      viewGroup: '查看群模板 {title} 的文档',
    },
    welcome: {
      selectTitle: '选择左侧文档查看',
      emptyTitle: '还没有会话文档',
      selectDesc: '从左侧列表中选择群报告、节点台账或会话索引',
      emptyDesc: '工作流跑完产生的群报告与节点审计台账将自动汇总于此',
      emptyTip: '跑完一个群流程后，群报告与节点台账会自动出现在左侧列表。',
    },
    unpinTitle: '取消固定',
    sortByGroup: '按群模板',
    sortByTime: '按时间',
    timeRange: {
      all: '全部时间',
      today: '今天',
      week: '最近 7 天',
      month: '最近 30 天',
      older: '更早以前',
    },
    export: {
      groupSuccess: '群文档导出成功',
      allSuccess: '全量文档导出成功',
      failed: '导出失败',
      allFailed: '全量导出失败',
    },
    copyAnchorSuccess: '已复制锚点链接',
    copyAnchorFallback: '锚点 {hash}',
    printPopupBlocked: '请允许弹出窗口以打印/保存 PDF',
    linkResolveFailed: '无法定位文档',
    copyCodeSuccess: '已复制代码',
    copyCodeFailed: '复制失败',
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
