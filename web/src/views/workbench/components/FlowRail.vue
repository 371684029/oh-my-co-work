<template>
  <aside class="wb-right" :aria-label="t('a11y.flowRail')">
    <FlowRailTabs />

    <!-- Tab：流程（适配步骤直接在节点标题上打「适配」角标，不再单开筛选 Tab） -->
    <FlowRailFlowPane v-show="flowStore.rightTab === 'flow'" />

    <FlowRailTimelinePane v-show="flowStore.rightTab === 'timeline'" />

    <!-- Tab：文档中心（含原群报告 MD，不再单独占一栏） -->
    <FlowRailDocsPane v-show="isDocsHubTab" />
  </aside>
</template>

<script setup>
import { computed, watch } from 'vue'
import { t } from '../../../i18n/index.js'
import { useFlowStore } from '../../../stores/flow.js'
import FlowRailTabs from './FlowRailTabs.vue'
import FlowRailFlowPane from './FlowRailFlowPane.vue'
import FlowRailTimelinePane from './FlowRailTimelinePane.vue'
import FlowRailDocsPane from './FlowRailDocsPane.vue'

const flowStore = useFlowStore()

const isDocsHubTab = computed(
  () => flowStore.rightTab === 'docs' || flowStore.rightTab === 'announce',
)
watch(
  () => flowStore.rightTab,
  (tab) => {
    if (tab === 'announce') flowStore.rightTab = 'docs'
  },
)
</script>

<style scoped>
.wb-right-pane {
  min-height: 0;
}
</style>
