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

import { engineBus } from './engine/events.js'
import { emitSession, emitAll } from './bus.js'

engineBus.on('ws_broadcast_session', (sessionId, payload) => {
  emitSession(sessionId, payload)
})

engineBus.on('ws_broadcast_all', (payload) => {
  emitAll(payload)
})

engineBus.on('update_node', (nodeId, patch) => {
  updateNode(nodeId, patch)
})

// ------------------------------------------------------------------
// EngineListener: 集中处理状态持久化等副作用，解耦 Engine 内部的 db 依赖
// Phase 4.8.0 目标：统一状态持久化
// ------------------------------------------------------------------
import { updateSession, persistNodeIo, addMessage, updateMessageContent, updateNode } from './engine/store.js'

engineBus.on('persist_session', (sessionId, patch) => {
  updateSession(sessionId, patch)
})

engineBus.on('persist_node_io', (sessionId, nodeId, ioData) => {
  persistNodeIo(sessionId, nodeId, ioData)
})

engineBus.on('add_message', (sessionId, msg) => {
  addMessage(sessionId, msg)
})

engineBus.on('update_message', (messageId, content) => {
  updateMessageContent(messageId, content)
})
