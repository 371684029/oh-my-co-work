<template>
  <div
    class="wb-right-tabs wb-right-tabs--segmented"
    role="tablist"
    :aria-label="t('a11y.flowRailTabs')"
  >
    <button
      type="button"
      class="wb-right-tab"
      role="tab"
      :aria-selected="flowStore.rightTab === 'flow'"
      :aria-label="t('a11y.flowTab')"
      :class="{ active: flowStore.rightTab === 'flow' }"
      @click="flowStore.rightTab = 'flow'"
    >
      <span class="wb-right-tab-icon" aria-hidden="true">⚡</span>
      <span class="wb-right-tab-label">{{ flowRailTabFlow() }}</span>
    </button>
    <button
      type="button"
      class="wb-right-tab"
      role="tab"
      :aria-selected="flowStore.rightTab === 'timeline'"
      :aria-label="t('a11y.timelineTab')"
      :class="{ active: flowStore.rightTab === 'timeline' }"
      @click="flowStore.rightTab = 'timeline'"
    >
      <span class="wb-right-tab-icon" aria-hidden="true">🕐</span>
      <span class="wb-right-tab-label">{{ flowRailTabTimeline() }}</span>
    </button>
    <button
      type="button"
      class="wb-right-tab"
      role="tab"
      :aria-selected="isDocsHubTab"
      :aria-label="t('a11y.docsTab')"
      :class="{ active: isDocsHubTab }"
      @click="flowStore.rightTab = 'docs'"
    >
      <span class="wb-right-tab-icon" aria-hidden="true">📄</span>
      <span class="wb-right-tab-label">{{ flowRailTabDocs() }}</span>
      <span v-if="flowStore.docsUnread > 0" class="wb-right-tab-badge">{{
        flowStore.docsUnread > 9 ? '9+' : flowStore.docsUnread
      }}</span>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { t } from '../../../i18n/index.js'
import {
  flowRailTabDocs,
  flowRailTabFlow,
  flowRailTabTimeline,
} from '../composables/flowRailCopy.js'
import { useFlowStore } from '../../../stores/flow.js'

const flowStore = useFlowStore()
const isDocsHubTab = computed(
  () => flowStore.rightTab === 'docs' || flowStore.rightTab === 'announce',
)
</script>

<style scoped>
.wb-right-tabs {
  display: flex;
  gap: 4px;
  margin: 0 0 14px;
  padding: 3px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.05);
  box-shadow: inset 0 0.5px 1px rgba(0, 0, 0, 0.04);
  container-type: inline-size;
}

.wb-right-tab {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  border: none;
  background: transparent;
  padding: 7px 6px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 550;
  color: var(--ecw-text-2, #6e6e73);
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}

.wb-right-tab:hover {
  color: var(--ecw-text-1, #1d1d1f);
}

.wb-right-tab.active {
  background: #fff;
  color: var(--ecw-accent, #007aff);
  font-weight: 650;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.wb-right-tabs--segmented .wb-right-tab {
  min-height: 36px;
  font-size: 13px;
}

.wb-right-tab-icon {
  flex-shrink: 0;
  margin-right: 4px;
}

.wb-right-tab-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 右栏较窄时三段装不下「图标 + 文字」：先去图标，保证文字单行 */
@container (max-width: 300px) {
  .wb-right-tab-icon {
    display: none;
  }
}

.wb-right-tab-badge {
  margin-left: 4px;
  min-width: 14px;
  padding: 0 4px;
  border-radius: 8px;
  font-size: 10px;
  line-height: 14px;
  background: rgba(230, 162, 60, 0.25);
  color: #9a6414;
}
</style>
