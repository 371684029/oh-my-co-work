/** Session gate API body builder (FE-01 pure logic). */

export function buildSessionGateBody({
  action,
  text,
  nodeInstanceId,
  questionId,
  choice,
  idempotencyKey,
}) {
  const body = {
    action,
    idempotencyKey,
  }
  const trimmed = String(text || '').trim()
  if (trimmed) body.text = trimmed
  if (nodeInstanceId) body.nodeInstanceId = nodeInstanceId
  if (questionId) body.questionId = questionId
  if (choice) body.choice = choice
  return body
}
