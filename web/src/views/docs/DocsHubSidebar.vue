<template>
  <aside class="dh-col dh-col-explorer" :aria-label="t('docs.a11y.explorer')">
    <div class="dh-explorer-head">
      <span class="dh-explorer-title">{{ docsHubColTitle(sort) }}</span>
      <el-button
        size="small"
        type="primary"
        link
        :aria-label="docsHubExportAllAria()"
        :loading="exportingAll"
        @click="$emit('export-all')"
      >
        {{ docsHubExportAllLabel() }}
      </el-button>
    </div>

    <div class="dh-toolbar-row">
      <el-segmented v-model="sort" :options="sortOptions" size="small" class="dh-segmented" />
      <el-button size="small" class="dh-refresh-btn" :loading="listLoading" @click="$emit('refresh')">
        {{ docsHubRefreshLabel() }}
      </el-button>
    </div>

    <div v-if="docsPinned.length || docsRecent.length" class="dh-quick-docs">
      <div v-if="docsPinned.length" class="dh-quick-section">
        <div class="dh-section-label">{{ docsHubPinnedSectionTitle() }}</div>
        <button
          v-for="item in docsPinned"
          :key="`p:${item.sessionId}:${item.name}`"
          type="button"
          class="dh-tree-row dh-tree-row--leaf"
          :class="{ active: isActiveFile(item.sessionId, item.name) }"
          @click="$emit('quick-open', item)"
        >
          <span class="dh-tree-label">{{ item.label || item.name }}</span>
          <span class="dh-quick-pin" :title="docsHubUnpinTitle()" @click.stop="$emit('toggle-pin', item)"
            >★</span
          >
        </button>
      </div>
      <div v-if="docsRecent.length" class="dh-quick-section">
        <div class="dh-section-label">{{ docsHubRecentSectionTitle() }}</div>
        <button
          v-for="item in docsRecent.slice(0, 8)"
          :key="`r:${item.sessionId}:${item.name}`"
          type="button"
          class="dh-tree-row dh-tree-row--leaf"
          :class="{ active: isActiveFile(item.sessionId, item.name) }"
          @click="$emit('quick-open', item)"
        >
          <span class="dh-tree-label">{{ item.label || item.name }}</span>
          <span
            v-if="!isPinnedItem(item)"
            class="dh-quick-pin is-off"
            :title="docsHubPinQuickTitle()"
            @click.stop="$emit('toggle-pin', item)"
            >☆</span
          >
        </button>
      </div>
    </div>

    <div class="dh-explorer-scroll">
      <template v-if="isSearching">
        <div v-if="searchLoading" class="dh-empty-tip">{{ docsHubSearchingLabel() }}</div>
        <div v-else-if="!searchResults.length" class="dh-empty-tip">{{ docsHubNoSearchHitsLabel() }}</div>
        <template v-else>
          <button
            v-for="hit in searchResults"
            :key="`${hit.sessionId}:${hit.name}:${hit.line}`"
            type="button"
            class="dh-search-hit"
            @click="$emit('search-hit', hit)"
          >
            <div class="dh-hit-title">{{ hit.title || hit.name }}</div>
            <div class="dh-hit-meta">{{ hit.groupTitle }} · {{ hit.sessionTitle }}</div>
            <div class="dh-hit-snippet" v-html="highlightSnippet(hit.snippet, searchQuery)" />
            <div class="dh-hit-line">{{ docsHubHitLineLabel(hit.line) }}</div>
          </button>
        </template>
      </template>

      <template v-else-if="sort === 'time'">
        <button
          v-for="range in timeRanges"
          :key="range.key"
          type="button"
          class="dh-tree-row dh-tree-row--filter"
          :class="{ active: selectedTimeRange === range.key }"
          @click="$emit('update:selectedTimeRange', range.key)"
        >
          <span class="dh-tree-chevron" aria-hidden="true" />
          <span class="dh-tree-icon">{{ range.icon }}</span>
          <span class="dh-tree-label">{{ range.label }}</span>
          <span class="dh-tree-meta">{{ range.count }}</span>
        </button>

        <div v-if="listLoading && !hasDocs" class="dh-empty-tip">{{ docsHubListLoadingLabel() }}</div>
        <div v-else-if="listError && !hasDocs" class="dh-empty-tip">{{ listError }}</div>
        <template v-else>
          <button
            v-for="it in displayedTimeItems"
            :key="`${it.sessionId}:${it.name}`"
            type="button"
            class="dh-tree-row dh-tree-row--leaf dh-tree-row--indent-1"
            :class="{ active: isActiveFile(it.sessionId, it.name) }"
            @click="$emit('select-file', it.sessionId, it.name)"
          >
            <span class="dh-tree-chevron" aria-hidden="true" />
            <span class="dh-tree-label">{{ docsFileLabel(it) }}</span>
            <span class="dh-tree-meta">{{ relativeTime(it.mtimeMs) }}</span>
          </button>
          <div v-if="!displayedTimeItems.length" class="dh-empty-tip">{{ docsHubNoDocsInRange() }}</div>
        </template>
      </template>

      <template v-else>
        <div v-if="listLoading && !hasDocs" class="dh-empty-tip">{{ docsHubListLoadingLabel() }}</div>
        <div v-else-if="listError && !hasDocs" class="dh-empty-tip">{{ listError }}</div>
        <div v-else-if="!groups.length" class="dh-empty-tip">{{ docsHubNoGroups() }}</div>

        <div v-for="g in groups" v-else :key="groupKey(g)" class="dh-tree-group">
          <div class="dh-tree-row dh-tree-row--branch">
            <button
              type="button"
              class="dh-tree-row-main"
              :aria-expanded="isGroupExpanded(groupKey(g))"
              @click="$emit('toggle-group', groupKey(g))"
            >
              <span
                class="dh-tree-chevron"
                :class="{ open: isGroupExpanded(groupKey(g)) }"
                aria-hidden="true"
                >›</span
              >
              <AcwIcon class="dh-tree-folder" name="folder" :size="16" />
              <span class="dh-tree-label">{{ g.groupTitle }}</span>
              <span class="dh-tree-meta">{{ sessionCount(g) }}</span>
            </button>
            <button
              v-if="g.groupId"
              type="button"
              class="dh-tree-action"
              :title="docsHubExportGroupShort()"
              :aria-label="docsHubExportGroupAria(g.groupTitle)"
              @click.stop="$emit('export-group', g.groupId)"
            >
              {{ docsHubExportGroupShort() }}
            </button>
          </div>

          <template v-if="isGroupExpanded(groupKey(g))">
            <div v-for="s in g.sessions" :key="s.sessionId" class="dh-tree-session">
              <button
                type="button"
                class="dh-tree-row dh-tree-row--branch dh-tree-row--indent-1"
                :aria-expanded="isSessionExpanded(s.sessionId)"
                @click="$emit('toggle-session', s.sessionId)"
              >
                <span
                  class="dh-tree-chevron"
                  :class="{ open: isSessionExpanded(s.sessionId) }"
                  aria-hidden="true"
                  >›</span
                >
                <span
                  class="dh-status-dot"
                  :class="docsSessionStatusClass(s.status)"
                  :title="docsSessionStatusLabel(s.status)"
                  aria-hidden="true"
                />
                <span class="dh-tree-label">{{ s.sessionTitle }}</span>
                <span class="dh-tree-meta">{{ relativeTime(s.updatedAt) }}</span>
              </button>

              <template v-if="isSessionExpanded(s.sessionId)">
                <button
                  v-for="f in s.files"
                  :key="f.name"
                  type="button"
                  class="dh-tree-row dh-tree-row--leaf dh-tree-row--indent-2"
                  :class="{ active: isActiveFile(s.sessionId, f.name) }"
                  @click="$emit('select-file', s.sessionId, f.name)"
                >
                  <span class="dh-tree-chevron" aria-hidden="true" />
                  <span class="dh-tree-label">{{ docsFileLabel(f) }}</span>
                  <span v-if="f.meta?.adapt" class="dh-badge dh-badge--adapt">{{ docsHubBadgeAdaptLabel() }}</span>
                  <span v-if="f.meta?.cloned" class="dh-badge dh-badge--cloned">{{ docsHubBadgeClonedLabel() }}</span>
                </button>
              </template>
            </div>
          </template>
        </div>
      </template>

      <div v-if="!listLoading && !listError && !hasDocs && !isSearching" class="dh-empty-tip">
        {{ docsHubNoSessionDocs() }}
      </div>
    </div>
  </aside>
</template>

<script setup>
import AcwIcon from '../../components/icons/AcwIcon.vue'
import { docsGroupKey } from './docsHubFilterUi.js'
import { highlightSearchSnippet } from './docsHubSearchUi.js'
import {
  docsFileLabel,
  docsSessionStatusClass,
  docsSessionStatusLabel,
} from './docsHubStatusUi.js'
import {
  docsHubBadgeAdaptLabel,
  docsHubBadgeClonedLabel,
  docsHubColTitle,
  docsHubExportAllAria,
  docsHubExportAllLabel,
  docsHubExportGroupAria,
  docsHubExportGroupShort,
  docsHubHitLineLabel,
  docsHubListLoadingLabel,
  docsHubNoDocsInRange,
  docsHubNoGroups,
  docsHubNoSearchHitsLabel,
  docsHubNoSessionDocs,
  docsHubPinQuickTitle,
  docsHubPinnedSectionTitle,
  docsHubRecentSectionTitle,
  docsHubRefreshLabel,
  docsHubSearchingLabel,
  docsHubUnpinTitle,
} from './docsHubCopy.js'

const searchQuery = defineModel('searchQuery', { type: String, default: '' })
const sort = defineModel('sort', { type: String, default: 'group' })

defineProps({
  sortOptions: { type: Array, default: () => [] },
  listLoading: { type: Boolean, default: false },
  docsPinned: { type: Array, default: () => [] },
  docsRecent: { type: Array, default: () => [] },
  isSearching: { type: Boolean, default: false },
  searchLoading: { type: Boolean, default: false },
  searchResults: { type: Array, default: () => [] },
  groups: { type: Array, default: () => [] },
  displayedTimeItems: { type: Array, default: () => [] },
  timeRanges: { type: Array, default: () => [] },
  selectedTimeRange: { type: String, default: 'all' },
  listError: { type: String, default: '' },
  hasDocs: { type: Boolean, default: false },
  exportingAll: { type: Boolean, default: false },
  isActiveFile: { type: Function, required: true },
  isPinnedItem: { type: Function, required: true },
  isSessionExpanded: { type: Function, required: true },
  isGroupExpanded: { type: Function, required: true },
  relativeTime: { type: Function, required: true },
})

defineEmits([
  'refresh',
  'quick-open',
  'toggle-pin',
  'search-hit',
  'toggle-session',
  'toggle-group',
  'select-file',
  'export-all',
  'export-group',
  'update:selectedTimeRange',
])

function groupKey(g) {
  return docsGroupKey(g)
}

function sessionCount(g) {
  return (g.sessions || []).length
}

function highlightSnippet(snippet, query) {
  return highlightSearchSnippet(snippet, query)
}
</script>

<style scoped>
.dh-col-explorer {
  width: min(320px, 34vw);
  min-width: 260px;
  max-width: 360px;
  padding: 8px 0 10px;
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

.dh-explorer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px 6px;
  margin-bottom: 4px;
}

.dh-explorer-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ecw-text-3, #86868b);
}

.dh-toolbar-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px 8px;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
  margin-bottom: 4px;
}

.dh-segmented {
  flex: 1;
}

.dh-refresh-btn {
  flex-shrink: 0;
}

.dh-quick-docs {
  padding: 6px 0;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
}

.dh-quick-section + .dh-quick-section {
  margin-top: 4px;
}

.dh-section-label {
  padding: 4px 12px 2px;
  font-size: 11px;
  font-weight: 600;
  color: var(--ecw-text-3, #86868b);
}

.dh-explorer-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 0;
}

.dh-tree-group + .dh-tree-group {
  margin-top: 2px;
}

.dh-tree-row {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  min-height: 26px;
  height: 26px;
  padding: 0 8px 0 6px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
  color: var(--ecw-text-1, #1d1d1f);
  transition: background 0.12s ease;
}

.dh-tree-row:hover,
.dh-tree-row.active {
  background: var(--ecw-surface-hover, rgba(0, 0, 0, 0.06));
}

.dh-tree-row.active {
  background: var(--ecw-accent-soft, rgba(0, 122, 255, 0.12));
  color: var(--ecw-accent, #007aff);
}

.dh-tree-row--indent-1 {
  padding-left: 14px;
}

.dh-tree-row--indent-2 {
  padding-left: 28px;
}

.dh-tree-row--branch {
  font-weight: 500;
}

.dh-tree-row--leaf .dh-tree-label {
  font-weight: 400;
}

.dh-tree-row--filter.active {
  color: var(--ecw-accent, #007aff);
  font-weight: 600;
}

.dh-tree-row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: inherit;
}

.dh-tree-row--branch.dh-tree-row {
  padding-right: 4px;
}

.dh-tree-chevron {
  flex-shrink: 0;
  width: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--ecw-text-3, #86868b);
  transition: transform 0.12s ease;
}

.dh-tree-chevron.open {
  transform: rotate(90deg);
}

.dh-tree-icon {
  flex-shrink: 0;
  width: 16px;
  text-align: center;
  font-size: 12px;
}

.dh-tree-folder {
  flex-shrink: 0;
  color: var(--ecw-text-3, #86868b);
}

.dh-tree-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dh-tree-meta {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--ecw-text-3, #86868b);
}

.dh-tree-action {
  flex-shrink: 0;
  height: 22px;
  padding: 0 6px;
  border: none;
  border-radius: 4px;
  background: transparent;
  font-size: 10.5px;
  font-weight: 500;
  color: var(--ecw-accent, #007aff);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s ease, background 0.12s ease;
}

.dh-tree-row--branch:hover .dh-tree-action,
.dh-tree-action:focus-visible {
  opacity: 1;
}

.dh-tree-action:hover {
  background: rgba(0, 122, 255, 0.1);
}

.dh-status-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #c7c7cc;
}

.dh-status-dot.active {
  background: var(--ecw-accent, #007aff);
}

.dh-quick-pin {
  font-size: 12px;
  color: var(--ecw-accent, #007aff);
}

.dh-quick-pin.is-off {
  color: var(--ecw-text-3, #86868b);
  opacity: 0.45;
}

.dh-badge {
  font-size: 10px;
  padding: 0 4px;
  border-radius: 3px;
  line-height: 16px;
}

.dh-badge--adapt {
  background: rgba(230, 162, 60, 0.15);
  color: #b87d1e;
}

.dh-badge--cloned {
  background: rgba(103, 194, 58, 0.15);
  color: #4a9c2d;
}

.dh-empty-tip {
  padding: 10px 12px;
  font-size: 12px;
  color: var(--ecw-text-3, #86868b);
  line-height: 1.45;
}

.dh-search-hit {
  width: 100%;
  padding: 6px 10px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
  margin-bottom: 2px;
}

.dh-search-hit:hover {
  background: var(--ecw-surface-hover, rgba(0, 0, 0, 0.06));
}

.dh-hit-title {
  font-size: 12px;
  font-weight: 650;
}

.dh-hit-meta {
  font-size: 11px;
  color: var(--ecw-text-3, #86868b);
}

.dh-hit-snippet {
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--ecw-text-2, #6e6e73);
  margin-top: 2px;
}

.dh-hit-snippet :deep(mark) {
  background: rgba(255, 200, 0, 0.35);
  border-radius: 2px;
}

.dh-hit-line {
  font-size: 10px;
  color: var(--ecw-text-3, #86868b);
}
</style>
