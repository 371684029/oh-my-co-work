/**
 * Server-side notification intent layer (5.4.0 NTF-02 residual).
 * Classifies engine bus events into notification intents: session terminal
 * states (done/archived) and announcement updates → level `done`. Intents are
 * persisted to `notification_inbox` (NTF-06, restart-safe) and re-broadcast as
 * `external.notify` so any connected renderer delivers them through the
 * existing foreground / DND policy. Event ids are stable for dedupe.
 */
import { doneNotificationIntentForEvent } from '@acw/shared'
import { engineBus, ENGINE_EVENTS } from './engine/events.js'
import { emitAll } from './bus.js'
import { getDb } from './db.js'
import { upsertInboxItem } from './notificationInbox.js'

let attached = false

function sessionTitleOf(sessionId) {
  try {
    const row = getDb().prepare('SELECT title FROM sessions WHERE id = ?').get(sessionId)
    return row?.title || ''
  } catch {
    return ''
  }
}

/** Map one bus event payload; returns the stored intent row or null. */
export function handleNotificationIntent(event) {
  let intent = null
  try {
    intent = doneNotificationIntentForEvent(event, {
      sessionTitle: sessionTitleOf(String(event?.payload?.sessionId || '')),
    })
  } catch {
    return null
  }
  if (!intent) return null
  try {
    upsertInboxItem({
      id: intent.id,
      eventId: intent.id,
      level: intent.level,
      sessionId: intent.sessionId,
      title: intent.title,
      body: intent.body,
      deepLink: intent.deepLink,
    })
  } catch (e) {
    console.warn('[acw] notification inbox write failed', e?.message || e)
  }
  try {
    emitAll({
      type: 'external.notify',
      payload: {
        id: intent.id,
        title: intent.title,
        body: intent.body,
        level: intent.level,
        deepLink: intent.deepLink,
        source: 'server',
      },
    })
  } catch (e) {
    console.warn('[acw] notification intent broadcast failed', e?.message || e)
  }
  return intent
}

export function attachNotificationIntentListeners() {
  if (attached) return
  attached = true
  // Registered after the WS fan-out listeners so the raw event reaches clients
  // first; same-id external.notify then dedupes renderer-side (stable eventIds).
  engineBus.on(ENGINE_EVENTS.WS_BROADCAST_SESSION, (_sessionId, payload) => {
    handleNotificationIntent(payload)
  })
  engineBus.on(ENGINE_EVENTS.WS_BROADCAST_ALL, (payload) => {
    handleNotificationIntent(payload)
  })
}

export function notificationIntentListenersAttached() {
  return attached
}
