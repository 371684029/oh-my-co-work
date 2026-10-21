<template>
  <aside class="dh-col dh-col-sessions">
    <div class="dh-search-box">
      <el-input
        v-model="searchQuery"
        :placeholder="docsHubSearchPlaceholder()"
        :aria-label="docsHubSearchPlaceholder()"
        clearable
        size="small"
      />
    </div>

    <div class="dh-toolbar-row">
      <el-segmented v-model="sort" :options="sortOptions" size="small" class="dh-segmented" />
      <el-button size="small" class="dh-refresh-btn" :loading="listLoading" @click="$emit('refresh')">
        {{ docsHubRefreshLabel() }}
      </el-button>
    </div>

    <div v-if="docsPinned.length || docsRecent.length" class="dh-quick-docs">
      <div v-if="docsPinned.length" class="dh-quick-section">
        <div class="dh-quick-title">{{ docsHubPinnedSectionTitle() }}</div>
        <button
          v-for="item in docsPinned"
          :key="`p:${item.sessionId}:${item.name}`"
          type="button"
          class="dh-quick-item"
          :class="{ active: isActiveFile(item.sessionId, item.name) }"
          @click="$emit('quick-open', item)"
        >
          <span class="dh-quick-name">{{ item.label || item.name }}</span>
          <span class="dh-quick-pin" :title="docsHubUnpinTitle()" @click.stop="$emit('toggle-pin', item)"
            >★</span
          >
        </button>
      </div>
      <div v-if="docsRecent.length" class="dh-quick-section">
        <div class="dh-quick-title">{{ docsHubRecentSectionTitle() }}</div>
        <button
          v-for="item in docsRecent.slice(0, 8)"
          :key="`r:${item.sessionId}:${item.name}`"
          type="button"
          class="dh-quick-item"
          :class="{ active: isActiveFile(item.sessionId, item.name) }"
          @click="$emit('quick-open', item)"
        >
          <span class="dh-quick-name">{{ item.label || item.name }}</span>
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

    <div class="dh-sessions-menu">
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

      <template v-else>
        <div v-if="listLoading && !hasDocs" class="dh-empty-tip">{{ docsHubListLoadingLabel() }}</div>
        <div v-else-if="listError && !hasDocs" class="dh-empty-tip">{{ listError }}</div>

        <template v-else-if="sort === 'group'">
          <div v-for="g in displayedGroups" :key="groupKey(g)" class="dh-group-block">
            <div v-if="selectedGroupId === 'all'" class="dh-subgroup-title">{{ g.groupTitle }}</div>
            <div v-for="s in g.sessions" :key="s.sessionId" class="dh-session-block">
              <button
                type="button"
                class="dh-session-row"
                :class="{ active: isSessionExpanded(s.sessionId) }"
                @click="$emit('toggle-session', s.sessionId)"
              >
                <span
                  class="dh-caret"
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
                <span class="dh-session-title">{{ s.sessionTitle }}</span>
                <span class="dh-session-time">{{ relativeTime(s.updatedAt) }}</span>
              </button>

              <div v-show="isSessionExpanded(s.sessionId)" class="dh-file-list">
                <button
                  v-for="f in s.files"
                  :key="f.name"
                  type="button"
                  class="dh-file-row"
                  :class="{ active: isActiveFile(s.sessionId, f.name) }"
                  @click="$emit('select-file', s.sessionId, f.name)"
                >
                  <span class="dh-file-row-name">{{ docsFileLabel(f) }}</span>
                  <span class="dh-kind-chip">{{ f.title }}</span>
                  <span v-if="f.meta?.adapt" class="dh-badge dh-badge--adapt">{{ docsHubBadgeAdaptLabel() }}</span>
                  <span v-if="f.meta?.cloned" class="dh-badge dh-badge--cloned">{{ docsHubBadgeClonedLabel() }}</span>
                </button>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <button
            v-for="it in displayedTimeItems"
            :key="`${it.sessionId}:${it.name}`"
            type="button"
            class="dh-time-row"
            :class="{ active: isActiveFile(it.sessionId, it.name) }"
            @click="$emit('select-file', it.sessionId, it.name)"
          >
            <div class="dh-time-row-main">
              <span class="dh-time-row-name">{{ docsFileLabel(it) }}</span>
              <span class="dh-time-row-sub">{{ it.groupTitle }} · {{ it.sessionTitle }}</span>
            </div>
            <span class="dh-time-row-meta">{{ relativeTime(it.mtimeMs) }}</span>
          </button>
          <div v-if="!displayedTimeItems.length" class="dh-empty-tip">{{ docsHubNoDocsInRange() }}</div>
        </template>
      </template>

      <div v-if="!listLoading && !listError && !hasDocs" class="dh-empty-tip">
        {{ docsHubNoSessionDocs() }}
      </div>
    </div>
  </aside>
</template>

<script setup>
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
  docsHubHitLineLabel,
  docsHubListLoadingLabel,
  docsHubNoDocsInRange,
  docsHubNoSearchHitsLabel,
  docsHubNoSessionDocs,
  docsHubPinQuickTitle,
  docsHubPinnedSectionTitle,
  docsHubRecentSectionTitle,
  docsHubRefreshLabel,
  docsHubSearchPlaceholder,
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
  displayedGroups: { type: Array, default: () => [] },
  displayedTimeItems: { type: Array, default: () => [] },
  selectedGroupId: { type: String, default: 'all' },
  listError: { type: String, default: '' },
  hasDocs: { type: Boolean, default: false },
  isActiveFile: { type: Function, required: true },
  isPinnedItem: { type: Function, required: true },
  isSessionExpanded: { type: Function, required: true },
  relativeTime: { type: Function, required: true },
})

defineEmits(['refresh', 'quick-open', 'toggle-pin', 'search-hit', 'toggle-session', 'select-file'])

function groupKey(g) {
  return docsGroupKey(g)
}

function highlightSnippet(snippet, query) {
  return highlightSearchSnippet(snippet, query)
}
</script>

<style scoped>
.dh-col-sessions {
  width: 290px;
  min-width: 270px;
  max-width: 320px;
  padding: 12px 10px 14px;
}

.dh-search-box {
  margin-bottom: 8px;
}

.dh-toolbar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.dh-segmented {
  flex: 1;
}

.dh-refresh-btn {
  flex-shrink: 0;
}

.dh-quick-docs {
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 0.5px solid var(--ecw-border, rgba(0, 0, 0, 0.06));
}

.dh-quick-section + .dh-quick-section {
  margin-top: 8px;
}

.dh-quick-title {
  font-size: var(--ecw-font-xs, 12px);
  font-weight: 700;
  color: var(--ecw-text-3, #86868b);
  margin-bottom: 4px;
}

.dh-quick-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  border: none;
  background: transparent;
  padding: 5px 8px;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  font-size: var(--ecw-font-sm, 13px);
}

.dh-quick-item:hover,
.dh-quick-item.active {
  background: var(--ecw-surface-hover, rgba(0, 0, 0, 0.04));
}

.dh-quick-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dh-quick-pin {
  font-size: 12px;
  color: var(--ecw-accent, #007aff);
  opacity: 0.9;
}

.dh-quick-pin.is-off {
  color: var(--ecw-text-3, #86868b);
  opacity: 0.5;
}

.dh-sessions-menu {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.dh-empty-tip {
  padding: 12px 8px;
  font-size: 12px;
  color: var(--ecw-text-3, #86868b);
  line-height: 1.5;
}

.dh-subgroup-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--ecw-text-3, #86868b);
  padding: 6px 8px 3px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.dh-session-block {
  margin-bottom: 4px;
}

.dh-session-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 8px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}

.dh-session-row:hover {
  background: var(--ecw-surface-hover, rgba(0, 0, 0, 0.04));
}

.dh-caret {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  font-size: 13px;
  color: var(--ecw-text-3, #86868b);
  transition: transform 0.15s ease;
}

.dh-caret.open {
  transform: rotate(90deg);
}

.dh-status-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #d0d0d6;
}

.dh-status-dot.active {
  background: var(--ecw-accent, #007aff);
}

.dh-session-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ecw-text-1, #1d1d1f);
}

.dh-session-time {
  font-size: 10.5px;
  color: var(--ecw-text-3, #86868b);
}

.dh-file-list {
  margin-left: 18px;
  padding: 2px 0 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dh-file-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}

.dh-file-row:hover {
  background: var(--ecw-surface-hover, rgba(0, 0, 0, 0.04));
}

.dh-file-row.active {
  background: var(--ecw-accent-soft, rgba(0, 122, 255, 0.1));
  box-shadow: inset 0 0 0 0.5px rgba(0, 122, 255, 0.18);
}

.dh-file-row-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--ecw-text-1, #1d1d1f);
}

.dh-file-row.active .dh-file-row-name {
  color: var(--ecw-accent, #007aff);
  font-weight: 600;
}

.dh-badge {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 4px;
  line-height: 1.2;
}

.dh-badge--adapt {
  background: rgba(230, 162, 60, 0.15);
  color: #b87d1e;
}

.dh-badge--cloned {
  background: rgba(103, 194, 58, 0.15);
  color: #4a9c2d;
}

.dh-time-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  margin-bottom: 2px;
  transition: background 0.15s ease;
}

.dh-time-row:hover {
  background: var(--ecw-surface-hover, rgba(0, 0, 0, 0.04));
}

.dh-time-row.active {
  background: var(--ecw-accent-soft, rgba(0, 122, 255, 0.1));
}

.dh-time-row-main {
  flex: 1;
  min-width: 0;
}

.dh-time-row-name {
  display: block;
  font-size: 12.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dh-time-row-sub {
  display: block;
  font-size: 11px;
  color: var(--ecw-text-3, #86868b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dh-time-row-meta {
  font-size: 10.5px;
  color: var(--ecw-text-3, #86868b);
}

.dh-search-hit {
  width: 100%;
  padding: 8px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  margin-bottom: 4px;
}

.dh-search-hit:hover {
  background: var(--ecw-surface-hover, rgba(0, 0, 0, 0.04));
}

.dh-hit-title {
  font-size: 12px;
  font-weight: 650;
  color: var(--ecw-text-1, #1d1d1f);
}

.dh-hit-meta {
  font-size: 11px;
  color: var(--ecw-text-3, #86868b);
}

.dh-hit-snippet {
  font-size: 11.5px;
  line-height: 1.45;
  color: var(--ecw-text-2, #6e6e73);
  margin-top: 3px;
}

.dh-hit-snippet :deep(mark) {
  background: rgba(255, 200, 0, 0.35);
  border-radius: 2px;
}

.dh-hit-line {
  font-size: 10px;
  color: var(--ecw-text-3, #86868b);
  margin-top: 2px;
}
</style>
