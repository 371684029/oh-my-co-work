import { EventEmitter } from 'node:events'

/**
 * 引擎内部事件总线：解耦状态机与 WS / 持久化副作用。
 * 必须通过 engineEmit 派发；无监听器时抛错，避免静默丢库。
 */
export const ENGINE_EVENTS = Object.freeze({
  WS_BROADCAST_SESSION: 'ws_broadcast_session',
  WS_BROADCAST_ALL: 'ws_broadcast_all',
  UPDATE_NODE: 'update_node',
  PERSIST_SESSION: 'persist_session',
  PERSIST_NODE_IO: 'persist_node_io',
  ADD_MESSAGE: 'add_message',
  UPDATE_MESSAGE: 'update_message',
})

export const engineBus = new EventEmitter()
engineBus.setMaxListeners(20)

export function engineEmit(event, ...args) {
  if (engineBus.listenerCount(event) === 0) {
    const err = new Error(`[engineBus] no listener for "${event}"`)
    err.code = 'ENGINE_BUS_NO_LISTENER'
    throw err
  }
  return engineBus.emit(event, ...args)
}
