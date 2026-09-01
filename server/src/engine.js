// Engine facade — re-exports the workflow engine's public API.
// 3.8.0 起 engine.js 拆分为 ./engine/ 模块；本文件只做门面，
// routes / services / index / 测试的 import 路径与导出名保持不变。
//
// 模块依赖（单向，禁止环）：
//   store → offsite → archive → adapterEvents → advance
//   sessionLifecycle → (store/offsite/archive/advance)
//   gates → (store/offsite/archive/adapterEvents/sessionLifecycle/advance)
//   mentions → (store/offsite)
//   userInput → (store/offsite/archive/gates/mentions)

export {
  pruneIdleOffsitePlaceholders,
  ensureOffsiteNode,
} from './engine/offsite.js'

export {
  ensureArchiveTailNode,
  skipArchiveNode,
  dismissPendingArchiveIfAny,
  requestArchiveConsent,
  processDueArchives,
  refreshSessionAnnouncement,
  saveSessionAnnouncement,
  archiveSession,
  unarchiveSession,
  markInterruptedOnBoot,
} from './engine/archive.js'

export { applyAdapterEvent, answerAdapterQuestion } from './engine/adapterEvents.js'

export { advance, openFlowGate } from './engine/advance.js'

export {
  createSessionFromGroup,
  createSessionFromMember,
  bypassAbandonedNodes,
  restartFromNode,
  resolveInterruptedSession,
} from './engine/sessionLifecycle.js'

export { handleGateAction } from './engine/gates.js'

export { parseMemberMentions, invokeMentionedMembers } from './engine/mentions.js'

export { postUserMessage } from './engine/userInput.js'
