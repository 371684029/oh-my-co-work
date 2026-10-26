<template>
  <div v-if="files.length" class="docs-rail-files">
    <el-select
      :model-value="selectedName"
      class="docs-rail-file-select"
      size="small"
      filterable
      :placeholder="flowRailDocsSelectPlaceholder()"
      @update:model-value="$emit('select', $event)"
    >
      <el-option
        v-for="f in files"
        :key="f.name"
        :label="`${f.title || f.name}`"
        :value="f.name"
      />
    </el-select>
    <div class="docs-rail-file-pills" aria-hidden="true">
      <button
        v-for="f in files"
        :key="f.name"
        type="button"
        class="docs-rail-file-pill"
        :class="{ active: selectedName === f.name }"
        @click="$emit('select', f.name)"
      >
        <span class="pill-name">{{ f.title || f.name }}</span>
        <span class="pill-badge">{{
          f.kind === 'announce' ? flowRailDocsBadgeReport() : flowRailDocsBadgeJournal()
        }}</span>
      </button>
    </div>
  </div>
  <div v-else-if="!loading" class="docs-rail-empty">
    {{ flowRailDocsNoFiles() }}
  </div>
</template>

<script setup>
import {
  flowRailDocsBadgeJournal,
  flowRailDocsBadgeReport,
  flowRailDocsNoFiles,
  flowRailDocsSelectPlaceholder,
} from '../composables/flowRailCopy.js'

defineProps({
  files: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  selectedName: { type: String, default: '' },
})
defineEmits(['select'])
</script>

<style scoped>
.docs-rail-files {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.docs-rail-file-select {
  display: none;
  width: 100%;
}

.docs-rail-file-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 96px;
  overflow-y: auto;
  padding: 4px 2px;
}

@container docs-rail (max-width: 260px) {
  .docs-rail-file-select {
    display: block;
  }
  .docs-rail-file-pills {
    display: none;
  }
}

.docs-rail-file-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  border: 0;
  background: rgba(143, 149, 158, 0.12);
  color: #646a73;
  font-size: var(--ecw-font-xs, 12px);
  line-height: 18px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.docs-rail-file-pill:hover {
  background: rgba(143, 149, 158, 0.22);
}

.docs-rail-file-pill.active {
  background: rgba(51, 112, 255, 0.12);
  color: #3370ff;
  font-weight: 500;
}

.pill-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pill-badge {
  font-size: 9px;
  opacity: 0.7;
}

.docs-rail-empty {
  padding: 30px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--ecw-text-3, #86868b);
}
</style>
