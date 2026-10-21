/** English strings (DSK-08 partial; extend as pages migrate off hard-coded copy). */
export const strings = {
  a11y: {
    skipToMain: 'Skip to main content',
    settingsNav: 'Settings navigation',
    sessionRail: 'Session list',
    sessionList: 'Sessions',
    startChat: 'Start chat',
    flowRail: 'Flow and docs sidebar',
    flowRailTabs: 'Right panel views',
    flowTab: 'Flow steps',
    timelineTab: 'Timeline',
    docsTab: 'Docs hub',
    workbenchMain: 'Session main area',
    composer: 'Message composer',
    commandPaletteSearch: 'Command palette search',
    commandPaletteList: 'Command list',
  },
  furnace: {
    idle: 'Idle',
    working: 'Working',
    waiting: 'Waiting',
    open: 'Open furnace',
    peek: 'Expand',
    minimize: 'Collapse',
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
