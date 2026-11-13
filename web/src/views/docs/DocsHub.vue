<template>
  <div class="docs-hub">
    <div class="dh-body">
      <DocsHubSidebar
        v-model:search-query="searchQuery"
        v-model:sort="sort"
        :sort-options="sortOptions"
        :list-loading="listLoading"
        :docs-pinned="docsPinned"
        :docs-recent="docsRecent"
        :is-searching="isSearching"
        :search-loading="searchLoading"
        :search-results="searchResults"
        :groups="groups"
        :displayed-time-items="displayedTimeItems"
        :time-ranges="timeRanges"
        :selected-time-range="selectedTimeRange"
        :list-error="listError"
        :has-docs="hasDocs"
        :exporting-all="exportingAll"
        :is-active-file="isActiveFile"
        :is-pinned-item="isPinnedItem"
        :is-session-expanded="isSessionExpanded"
        :is-group-expanded="isGroupExpanded"
        :relative-time="relativeTime"
        @refresh="refresh"
        @quick-open="onQuickOpen"
        @toggle-pin="onTogglePin"
        @search-hit="onSearchHit"
        @toggle-session="toggleSession"
        @toggle-group="toggleGroup"
        @select-file="(sid, name) => selectFile(sid, name)"
        @export-all="onExportAll"
        @export-group="onExportGroup"
        @update:selected-time-range="selectedTimeRange = $event"
      />

      <DocsHubContentColumn :has-docs="hasDocs" :expand-for="expandFor" @go-workbench="goWorkbench" />
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import ElMessage from 'element-plus/es/components/message/index.mjs'
import { api } from '../../api'
import './docProse.css'
import {
  sort,
  sortOptions,
  listLoading,
  listError,
  groups,
  items,
  hasDocs,
  current,
  searchQuery,
  searchResults,
  searchLoading,
  isSearching,
  activateInDocSearch,
  relativeTime,
  ensureWorkFolders,
  loadList,
  loadFile,
  selectFile,
  confirmDiscardIfDirty,
  initDocsHub,
  disposeDocsHub,
  docsPinned,
  docsRecent,
  refreshDocsHistory,
} from '../workbench/composables/useDocsHub'
import { toggleDocsPin, isDocsPinned } from './docsReadingHistory.js'
import DocsHubSidebar from './DocsHubSidebar.vue'
import DocsHubContentColumn from './DocsHubContentColumn.vue'
import {
  docsTimeRangeBuckets,
  filterDocsItemsByTimeRange,
} from './docsHubFilterUi.js'
import {
  docsExpandSessionInTree,
  isDocsSessionExpanded,
  isDocsGroupExpanded,
  toggleDocsSessionExpansion,
  toggleDocsGroupExpansion,
} from './docsHubSessionUi.js'
import {
  docsExportAllErrorMessage,
  docsExportAllSuccessMessage,
  docsExportGroupErrorMessage,
  docsExportGroupSuccessMessage,
} from './docsHubMessages.js'

const route = useRoute()
const router = useRouter()

function goWorkbench() {
  void router.push('/workbench')
}

function isPinnedItem(item) {
  return isDocsPinned(item.sessionId, item.name, docsPinned.value)
}

function onTogglePin(item) {
  toggleDocsPin(item)
  refreshDocsHistory()
}

async function onQuickOpen(item) {
  expandFor(item.sessionId)
  await selectFile(item.sessionId, item.name)
}

const selectedTimeRange = ref('all')
const expandedSessions = ref({})
const expandedGroups = ref({})
const exportingAll = ref(false)

const timeRanges = computed(() => docsTimeRangeBuckets(items.value))

const displayedTimeItems = computed(() =>
  filterDocsItemsByTimeRange(items.value, selectedTimeRange.value),
)

function isSessionExpanded(id) {
  return isDocsSessionExpanded(expandedSessions.value, id)
}

function isGroupExpanded(id) {
  return isDocsGroupExpanded(expandedGroups.value, id)
}

function toggleSession(id) {
  expandedSessions.value = toggleDocsSessionExpansion(expandedSessions.value, id)
}

function toggleGroup(id) {
  expandedGroups.value = toggleDocsGroupExpansion(expandedGroups.value, id)
}

function expandFor(sessionId) {
  const patch = docsExpandSessionInTree(
    groups.value,
    sessionId,
    expandedSessions.value,
    expandedGroups.value,
  )
  if (!patch) return
  expandedGroups.value = patch.expandedGroups
  expandedSessions.value = patch.expandedSessions
}

function isActiveFile(sessionId, name) {
  return current.value?.sessionId === sessionId && current.value?.name === name
}

function onSearchHit(hit) {
  activateInDocSearch(searchQuery.value, hit.line || 1)
  expandFor(hit.sessionId)
  selectFile(hit.sessionId, hit.name)
}

async function onExportGroup(groupId) {
  try {
    await api.docs.downloadDocsExport(groupId)
    ElMessage.success(docsExportGroupSuccessMessage())
  } catch (e) {
    ElMessage.error(docsExportGroupErrorMessage(e))
  }
}

async function onExportAll() {
  exportingAll.value = true
  try {
    await api.docs.downloadAllDocsExport()
    ElMessage.success(docsExportAllSuccessMessage())
  } catch (e) {
    ElMessage.error(docsExportAllErrorMessage(e))
  } finally {
    exportingAll.value = false
  }
}

async function refresh() {
  if (!(await confirmDiscardIfDirty())) return
  await loadList({ force: true })
  if (current.value) await loadFile(current.value.sessionId, current.value.name)
}

onBeforeRouteLeave(async () => {
  return confirmDiscardIfDirty()
})

onMounted(async () => {
  initDocsHub({ route, router })
  await loadList()
  await ensureWorkFolders()
  const sid = route.query.session
  const fname = route.query.file
  if (sid && fname) {
    expandFor(String(sid))
    await selectFile(String(sid), String(fname), { force: true })
  }
})

onUnmounted(() => {
  disposeDocsHub()
})
</script>

<style scoped>
.docs-hub {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.dh-body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 10px;
}

.dh-col {
  border: 0.5px solid rgba(255, 255, 255, 0.65);
  border-radius: var(--ecw-radius-xl, 16px);
  background: var(--ecw-glass-strong, rgba(255, 255, 255, 0.8));
  backdrop-filter: saturate(160%) blur(36px);
  -webkit-backdrop-filter: saturate(160%) blur(36px);
  box-shadow: var(--ecw-shadow-md, 0 4px 16px rgba(0, 0, 0, 0.05));
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
