import { EventEmitter } from 'node:events'

/**
 * 引擎内部事件总线，负责解耦状态机流转与外部副作用（如 WS 广播）。
 * Phase 4.8.0 引入：使 engine/ 的核心逻辑不再直接引用 bus.js，便于后续完全解耦与测试注入。
 */
export const engineBus = new EventEmitter()

// 建议所有事件名都在此处登记，方便溯源
// 'ws_broadcast_session': (sessionId, payload) => void
// 'ws_broadcast_all': (payload) => void
