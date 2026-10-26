<template>
  <!-- Tab：流程（适配步骤直接在节点标题上打「适配」角标，不再单开筛选 Tab） -->
  <div class="wb-right-pane">
    <p v-if="detail?.session?.status === 'archived'" class="flow-archive-hint">
      {{ flowRailArchivedHint() }}
      <template v-if="archiveOutcomeTag">
        ·
        <span
          class="flow-archive-outcome"
          :class="archiveOutcomeTag.ok ? 'is-ok' : 'is-fail'"
          >{{ archiveOutcomeTag.label }}</span
        >
      </template>
    </p>
    <p v-else-if="offsiteActive" class="flow-offsite-hint">
      {{ flowRailOffsiteHint() }}
    </p>
    <template v-if="flowEntries.length">
      <template v-for="entry in flowEntries" :key="entry.key">
        <div
          v-if="entry.type === 'skipped'"
          class="flow-skipped-group"
          :class="{ open: isSkippedFlowGroupExpanded(entry) }"
        >
          <button
            type="button"
            class="flow-skipped-toggle"
            :aria-expanded="isSkippedFlowGroupExpanded(entry)"
            @click="toggleSkippedFlowGroup(entry)"
          >
            <span class="flow-skipped-toggle-icon" aria-hidden="true">{{
              isSkippedFlowGroupExpanded(entry) ? '⌄' : '›'
            }}</span>
            <span>{{
              isSkippedFlowGroupExpanded(entry)
                ? flowRailSkippedExpandLabel(entry.nodes.length)
                : flowRailSkippedCollapsedLabel(entry.nodes.length)
            }}</span>
          </button>
        </div>
        <template v-if="entry.type !== 'skipped' || isSkippedFlowGroupExpanded(entry)">
          <FlowRailNodeCard
            v-for="node in entry.nodes"
            :key="node.id"
            :node="node"
            :revert-loading-id="revertLoadingId"
            @revert="revertStepChanges"
          />
        </template>
      </template>

      <div
        class="flow-current-bar"
        :class="{
          'is-human-attention': needsHuman && !offsiteActive,
          'is-offsite-attention': offsiteActive,
        }"
      >
        <span class="flow-current-label">{{
          offsiteActive
            ? flowRailCurrentBarOffsite()
            : needsHuman
              ? flowRailCurrentBarNeedsHuman()
              : flowRailCurrentBarCurrentNode()
        }}</span>
        <strong>
          {{
            offsiteActive
              ? activeOffsiteNode?.title || flowRailCurrentBarOffsite()
              : detail.nodes.find((n) => isCurrent(n))?.title ||
                (detail.session.status === 'archived' ? flowRailArchivedReopen() : '—')
          }}
        </strong>
      </div>
    </template>
    <EmptyState
      v-else
      :title="flowRailEmptyFlowTitle()"
      :description="flowRailEmptyFlowDescription()"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import EmptyState from '../../../components/ui/EmptyState.vue'
import { api } from '../../../api'
import {
  flowRailArchivedHint,
  flowRailArchivedReopen,
  flowRailCurrentBarCurrentNode,
  flowRailCurrentBarNeedsHuman,
  flowRailCurrentBarOffsite,
  flowRailEmptyFlowDescription,
  flowRailEmptyFlowTitle,
  flowRailOffsiteHint,
  flowRailSkippedCollapsedLabel,
  flowRailSkippedExpandLabel,
} from '../composables/flowRailCopy.js'
import { createFlowRailRevertActions } from '../composables/flowRailRevertActions.js'
import {
  activeId,
  activeOffsiteNode,
  archiveOutcomeTag,
  detail,
  flowEntries,
  isCurrent,
  isSkippedFlowGroupExpanded,
  needsHuman,
  offsiteActive,
  toggleSkippedFlowGroup,
} from '../composables/useSessionDetail'
import FlowRailNodeCard from './FlowRailNodeCard.vue'

const revertLoadingId = ref('')
const { revertStepChanges } = createFlowRailRevertActions({ activeId, revertLoadingId, api })
</script>

<style scoped>
.flow-skipped-group {
  position: relative;
  margin: 2px 0 10px 7px;
  padding: 0 0 0 16px;
  border-left: 2px dashed rgba(0, 0, 0, 0.1);
}

.flow-skipped-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 5px 8px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.025);
  color: var(--ecw-text-3, #8e8ea0);
  font-size: 11.5px;
  line-height: 1.35;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;
}

.flow-skipped-toggle:hover {
  border-color: rgba(0, 122, 255, 0.2);
  background: rgba(0, 122, 255, 0.05);
  color: var(--ecw-accent, #007aff);
}

.flow-skipped-toggle-icon {
  flex-shrink: 0;
  font-size: 15px;
  line-height: 11px;
  transition: transform 0.15s ease;
}

.flow-skipped-group.open .flow-skipped-toggle-icon {
  transform: rotate(90deg);
}

.flow-archive-hint {
  margin: 0 0 12px;
  font-size: 11.5px;
  color: var(--ecw-text-3, #8b8f9a);
}

.flow-offsite-hint {
  margin: 0 0 12px;
  font-size: 11.5px;
  color: #9a6414;
  line-height: 1.45;
}

.flow-archive-outcome.is-ok {
  color: var(--el-color-success);
  font-weight: 600;
}
.flow-archive-outcome.is-fail {
  color: var(--el-color-danger);
  font-weight: 600;
}

.flow-current-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ecw-text-3, #8e8ea0);
  margin-bottom: 2px;
}
</style>
