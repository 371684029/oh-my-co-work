<template>
  <aside class="wb-right" :aria-label="t('a11y.flowRail')">
    <FlowRailTabs />

    <!-- Tab：流程（适配步骤直接在节点标题上打「适配」角标，不再单开筛选 Tab） -->
    <FlowRailFlowPane v-show="flowStore.rightTab === 'flow'" />

    <FlowRailTimelinePane v-show="flowStore.rightTab === 'timeline'" />
  </aside>
</template>

<script setup>
import { t } from '../../../i18n/index.js'
import { useFlowStore } from '../../../stores/flow.js'
import FlowRailTabs from './FlowRailTabs.vue'
import FlowRailFlowPane from './FlowRailFlowPane.vue'
import FlowRailTimelinePane from './FlowRailTimelinePane.vue'

const flowStore = useFlowStore()
</script>

<style scoped>
.wb-right-pane {
  min-height: 0;
}
</style>
