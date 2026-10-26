<template>
  <div class="wb-right-pane timeline-pane">
    <div class="timeline-toolbar">
      <el-select
        v-model="timelineFilter"
        size="small"
        style="width: 120px"
        @change="loadSessionTimeline"
      >
        <el-option
          v-for="opt in timelineFilterOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
      <el-button size="small" text :loading="timelineLoading" @click="loadSessionTimeline">
        {{ flowRailTimelineRefresh() }}
      </el-button>
      <el-button size="small" text :disabled="!activeId" @click="downloadSessionAudit">
        {{ flowRailTimelineAuditExport() }}
      </el-button>
    </div>
    <p v-if="!activeId" class="timeline-hint">{{ flowRailTimelineSelectSessionFirst() }}</p>
    <ul v-else-if="timelineEvents.length" class="timeline-list">
      <li v-for="ev in timelineEvents" :key="ev.id">
        <button type="button" class="timeline-item" @click="onTimelineEvent(ev)">
          <span class="timeline-time">{{ flowRailFormatTimelineAt(ev.at) }}</span>
          <span class="timeline-cat">{{ flowRailTimelineCatLabel(ev.category) }}</span>
          <span class="timeline-title">{{ ev.title }}</span>
        </button>
      </li>
    </ul>
    <EmptyState
      v-else-if="!timelineLoading"
      :title="flowRailEmptyTimelineTitle()"
      :description="flowRailEmptyTimelineDescription()"
    />

    <el-dialog
      v-model="terminalReplayOpen"
      :title="flowRailTerminalReplayTitle()"
      width="640px"
      append-to-body
    >
      <p v-if="terminalReplayMeta" class="timeline-hint">
        {{ terminalReplayMeta.truncated ? flowRailReplayTruncatedHint() : '' }}
        {{
          terminalReplayMeta.bytes ? flowRailReplayBytesLabel(terminalReplayMeta.bytes) : ''
        }}
      </p>
      <pre class="flow-io-pre flow-io-pre--diff terminal-replay-pre">{{ terminalReplayText }}</pre>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import EmptyState from '../../../components/ui/EmptyState.vue'
import { api } from '../../../api'
import {
  flowRailEmptyTimelineDescription,
  flowRailEmptyTimelineTitle,
  flowRailReplayBytesLabel,
  flowRailReplayTruncatedHint,
  flowRailTerminalReplayTitle,
  flowRailTimelineAuditExport,
  flowRailTimelineRefresh,
  flowRailTimelineSelectSessionFirst,
} from '../composables/flowRailCopy.js'
import {
  flowRailFormatTimelineAt,
  flowRailTimelineCatLabel,
  flowRailTimelineFilterOptions,
} from '../composables/flowRailTimelineUi.js'
import { createFlowRailTimelineActions } from '../composables/flowRailTimelineActions.js'
import { flowRailOpenNodeJournal } from '../composables/flowRailNodeDoc.js'
import { useFlowStore } from '../../../stores/flow.js'
import {
  activeId,
  detail,
  openDocsHub,
  toggleNodeExpand,
} from '../composables/useSessionDetail'

const flowStore = useFlowStore()
const timelineEvents = ref([])
const timelineFilter = ref('all')
const timelineFilterOptions = flowRailTimelineFilterOptions()
const timelineLoading = ref(false)
const terminalReplayOpen = ref(false)
const terminalReplayText = ref('')
const terminalReplayMeta = ref(null)

const { loadSessionTimeline, downloadSessionAudit, onTimelineEvent } =
  createFlowRailTimelineActions({
    activeId,
    detail,
    timelineEvents,
    timelineFilter,
    timelineLoading,
    terminalReplayOpen,
    terminalReplayText,
    terminalReplayMeta,
    flowStore,
    toggleNodeExpand,
    openNodeJournal: (n) => flowRailOpenNodeJournal(n, { openDocsHub }),
    api,
  })

watch(
  () => [flowStore.rightTab, activeId.value],
  ([tab]) => {
    if (tab === 'timeline') loadSessionTimeline()
  },
)
</script>

<style scoped>
.timeline-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.timeline-hint {
  font-size: 12px;
  color: var(--ecw-text-3, #8e8ea0);
}
.timeline-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: calc(100vh - 220px);
  overflow: auto;
}
.timeline-item {
  display: grid;
  grid-template-columns: 72px 44px 1fr;
  gap: 6px;
  width: 100%;
  text-align: left;
  padding: 8px 6px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  color: inherit;
}
.timeline-item:hover {
  background: var(--ecw-surface-2, rgba(0, 0, 0, 0.05));
}
.timeline-time {
  color: var(--ecw-text-3, #8e8ea0);
  font-variant-numeric: tabular-nums;
}
.timeline-cat {
  color: var(--ecw-text-2, #555);
  font-size: 11px;
}
.timeline-title {
  word-break: break-word;
}

.flow-io-pre {
  margin: 0;
  max-height: 160px;
  overflow: auto;
  font-size: 11.5px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--ecw-text-1, #0b0c0f);
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
}

.terminal-replay-pre {
  max-height: 420px;
  overflow: auto;
}
</style>
