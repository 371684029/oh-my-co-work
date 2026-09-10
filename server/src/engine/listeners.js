// 副作用监听：持久化与 WS 广播。由 engine.js 门面加载；重复 import 不会重复挂接。
import { engineBus, ENGINE_EVENTS } from './events.js'
import { emitSession, emitAll } from '../bus.js'
import {
  updateSession,
  persistNodeIo,
  addMessage,
  updateMessageContent,
  updateNode,
} from './store.js'

let attached = false

export function attachEngineListeners() {
  if (attached) return
  attached = true

  engineBus.on(ENGINE_EVENTS.WS_BROADCAST_SESSION, (sessionId, payload) => {
    emitSession(sessionId, payload)
  })
  engineBus.on(ENGINE_EVENTS.WS_BROADCAST_ALL, (payload) => {
    emitAll(payload)
  })
  engineBus.on(ENGINE_EVENTS.UPDATE_NODE, (nodeId, patch) => {
    updateNode(nodeId, patch)
  })
  engineBus.on(ENGINE_EVENTS.PERSIST_SESSION, (sessionId, patch) => {
    updateSession(sessionId, patch)
  })
  engineBus.on(ENGINE_EVENTS.PERSIST_NODE_IO, (sessionId, nodeId, ioData) => {
    persistNodeIo(sessionId, nodeId, ioData)
  })
  engineBus.on(ENGINE_EVENTS.ADD_MESSAGE, (sessionId, msg) => {
    addMessage(sessionId, msg)
  })
  engineBus.on(ENGINE_EVENTS.UPDATE_MESSAGE, (messageId, content) => {
    updateMessageContent(messageId, content)
  })
}

export function engineListenersAttached() {
  return attached
}

attachEngineListeners()
