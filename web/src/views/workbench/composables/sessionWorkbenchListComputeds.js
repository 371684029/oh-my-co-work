/** Session rail filter options and conversation list (FE-01). */
import { computed } from 'vue'
import { buildSessionListFilterOptions } from './sessionListFilterUi.js'
import { buildConversationItems } from './sessionListUi.js'

export function createSessionWorkbenchListComputeds({ sessions, members, listFilter }) {
  const filterOptions = computed(() => buildSessionListFilterOptions())

  const startableMembers = computed(() =>
    (members.value || []).filter((m) => m.enabled !== false),
  )

  const conversationItems = computed(() =>
    buildConversationItems(sessions.value, listFilter.value),
  )

  return { filterOptions, startableMembers, conversationItems }
}
