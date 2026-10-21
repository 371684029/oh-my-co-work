<template>
  <aside class="dh-col dh-col-groups">
    <div class="dh-col-head">
      <span class="dh-col-title">{{ docsHubColTitle(sort) }}</span>
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

    <div v-if="sort === 'group'" class="dh-group-list">
      <button
        type="button"
        class="dh-group-item"
        :class="{ active: selectedGroupId === 'all' }"
        :aria-label="docsHubAllGroupsAria()"
        @click="$emit('update:selectedGroupId', 'all')"
      >
        <AcwIcon class="dh-group-item-icon" name="folder" :size="16" />
        <span class="dh-group-item-name">{{ docsHubAllGroupsLabel() }}</span>
        <span class="dh-group-item-count">{{ totalSessionsCount }}</span>
      </button>

      <div v-for="g in groups" :key="groupKey(g)" class="dh-group-item-wrap">
        <button
          type="button"
          class="dh-group-item"
          :class="{ active: selectedGroupId === groupKey(g) }"
          :aria-label="docsHubViewGroupAria(g.groupTitle)"
          @click="$emit('update:selectedGroupId', groupKey(g))"
        >
          <AcwIcon class="dh-group-item-icon" name="users" :size="16" />
          <span class="dh-group-item-name">{{ g.groupTitle }}</span>
          <span class="dh-group-item-count">{{ sessionCount(g) }}</span>
        </button>
        <button
          v-if="g.groupId"
          type="button"
          class="dh-group-export-btn"
          :title="docsHubExportGroupShort()"
          :aria-label="docsHubExportGroupAria(g.groupTitle)"
          @click.stop="$emit('export-group', g.groupId)"
        >
          {{ docsHubExportGroupShort() }}
        </button>
      </div>

      <div v-if="!listLoading && !groups.length" class="dh-empty-tip">
        {{ docsHubNoGroups() }}
      </div>
    </div>

    <div v-else class="dh-group-list">
      <button
        v-for="range in timeRanges"
        :key="range.key"
        type="button"
        class="dh-group-item"
        :class="{ active: selectedTimeRange === range.key }"
        @click="$emit('update:selectedTimeRange', range.key)"
      >
        <span class="dh-group-item-icon">{{ range.icon }}</span>
        <span class="dh-group-item-name">{{ range.label }}</span>
        <span class="dh-group-item-count">{{ range.count }}</span>
      </button>
    </div>
  </aside>
</template>

<script setup>
import AcwIcon from '../../components/icons/AcwIcon.vue'
import { docsGroupKey } from './docsHubFilterUi.js'
import {
  docsHubAllGroupsAria,
  docsHubAllGroupsLabel,
  docsHubColTitle,
  docsHubExportAllAria,
  docsHubExportAllLabel,
  docsHubExportGroupAria,
  docsHubExportGroupShort,
  docsHubNoGroups,
  docsHubViewGroupAria,
} from './docsHubCopy.js'

defineProps({
  sort: { type: String, required: true },
  selectedGroupId: { type: String, required: true },
  selectedTimeRange: { type: String, required: true },
  groups: { type: Array, default: () => [] },
  timeRanges: { type: Array, default: () => [] },
  listLoading: { type: Boolean, default: false },
  exportingAll: { type: Boolean, default: false },
  totalSessionsCount: { type: Number, default: 0 },
})

defineEmits(['update:selectedGroupId', 'update:selectedTimeRange', 'export-all', 'export-group'])

function groupKey(g) {
  return docsGroupKey(g)
}

function sessionCount(g) {
  return (g.sessions || []).length
}
</script>

<style scoped>
.dh-col-groups {
  width: 220px;
  min-width: 200px;
  max-width: 240px;
  padding: 12px 10px;
}

.dh-col-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 6px 10px;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
  margin-bottom: 8px;
}

.dh-col-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--ecw-text-1, #1d1d1f);
}

.dh-group-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.dh-group-item-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dh-group-item {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: none;
  background: transparent;
  border-radius: 9px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}

.dh-group-item:hover {
  background: var(--ecw-surface-hover, rgba(0, 0, 0, 0.04));
}

.dh-group-item.active {
  background: var(--ecw-accent-soft, rgba(0, 122, 255, 0.1));
  box-shadow: inset 0 0 0 0.5px rgba(0, 122, 255, 0.18);
}

.dh-group-item-icon {
  font-size: 13px;
}

.dh-group-item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  color: var(--ecw-text-1, #1d1d1f);
}

.dh-group-item.active .dh-group-item-name {
  color: var(--ecw-accent, #007aff);
}

.dh-group-item-count {
  font-size: 11px;
  color: var(--ecw-text-3, #86868b);
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.04);
}

.dh-group-export-btn {
  flex-shrink: 0;
  border: none;
  background: rgba(0, 122, 255, 0.08);
  color: var(--ecw-accent, #007aff);
  padding: 3px 6px;
  border-radius: 6px;
  font-size: 10.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.dh-group-export-btn:hover {
  background: rgba(0, 122, 255, 0.16);
}

.dh-empty-tip {
  padding: 12px 8px;
  font-size: 12px;
  color: var(--ecw-text-3, #86868b);
  line-height: 1.5;
}
</style>
