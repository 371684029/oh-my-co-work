/** Idempotency keys for gate actions (FE-01). */

export function nextGateIdempotencyKey(action, nodeInstanceId, now = Date.now()) {
  const suffix = Math.random().toString(36).slice(2, 8)
  return `gate_${action || 'x'}_${nodeInstanceId || 'none'}_${now}_${suffix}`
}
