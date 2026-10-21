/** Post-delete navigation (FE-01 pure logic). */

export function shouldClearActiveSessionAfterDelete(deletedId, activeId) {
  return Boolean(deletedId && activeId === deletedId)
}

export function workbenchPathAfterDelete(deletedId, activeId) {
  return shouldClearActiveSessionAfterDelete(deletedId, activeId) ? '/workbench' : null
}
