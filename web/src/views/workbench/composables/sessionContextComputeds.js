/** Session # / hash composer state from detail context (FE-01). */
import { computed } from 'vue'
import { wholeOutputText, MAX_PROJECT_PARAMS } from '@acw/shared'
import { useComposerStore } from '../../../stores/composer.js'
import {
  parseSessionContext,
  extractSessionParamsList,
  sessionGroupCardFromContext,
  sessionGroupFolderFromContext,
} from './sessionContextUi.js'
import { buildHashComposerItems, filterHashComposerItems } from './sessionHashUi.js'

export function createSessionContextComputeds({ detail, activeId }) {
  function sessionCtx() {
    return parseSessionContext(detail.value?.session)
  }

  const sessionParamsList = computed(() =>
    extractSessionParamsList(sessionCtx(), MAX_PROJECT_PARAMS),
  )

  const sessionGroupCard = computed(() => sessionGroupCardFromContext(sessionCtx()))

  const sessionGroupFolder = computed(() => sessionGroupFolderFromContext(sessionCtx()))

  const hashItems = computed(() => {
    if (!activeId.value) return []
    return buildHashComposerItems({
      groupCard: sessionGroupCard.value || '',
      groupFolder: sessionGroupFolder.value || '',
      paramsList: sessionParamsList.value,
      nodes: detail.value?.nodes || [],
      maxParams: MAX_PROJECT_PARAMS,
      wholeOutputText,
    })
  })

  const filteredHashItems = computed(() =>
    filterHashComposerItems(hashItems.value, useComposerStore().hashQuery, {
      maxParams: MAX_PROJECT_PARAMS,
      paramsList: sessionParamsList.value,
    }),
  )

  return {
    sessionParamsList,
    sessionGroupCard,
    sessionGroupFolder,
    hashItems,
    filteredHashItems,
  }
}
