<template>
  <div
    :data-flow-node-id="node.id"
    class="flow-step"
    :class="[
      flowClass(node),
      {
        open: flowStore.expandedNodeId === node.id,
        'is-extra': node.step_type === 'offsite',
        'is-offsite-current': isCurrentOffsiteSegment(node),
        'is-offsite-archived': node.step_type === 'offsite' && !!node.output?.archived,
        'is-flow-history': isFlowHistoryNode(node),
        'is-cloned': isClonedNode(node),
        'is-flow-anchor': node.id === flowAnchorNodeId,
      },
    ]"
  >
    <div class="flow-dot" aria-hidden="true" />
    <div class="flow-step-body">
      <button type="button" class="flow-step-head" @click="toggleNodeExpand(node)">
        <div class="flow-step-title">
          <span
            class="flow-idx"
            :class="{ 'flow-idx--extra': node.step_type === 'offsite' }"
            >{{ node.step_index + 1 }}</span
          >
          <span class="flow-step-name">{{ node.title }}</span>
          <FlowRailNodeBadges :node="node" @open-journal="openNodeJournal" />
        </div>
        <div class="flow-step-meta">
          {{ stepTypeLabel(node.step_type) }} · {{ statusLabel(node.status) || node.status }}
          <span v-if="offsiteInvokedLabel(node)" class="meta-offsite-member">
            · {{ offsiteInvokedLabel(node) }}
          </span>
          <span v-if="reviewLabel(node)" class="meta-review" :class="'is-' + reviewAction(node)">
            · {{ reviewLabel(node) }}
          </span>
          <span v-if="node.gate" class="meta-gate"> · {{ flowRailMetaGatePending() }}</span>
          <span v-if="flowRailNodeChangeSummary(node)" class="meta-change">
            · {{ flowRailNodeChangeSummary(node) }}
          </span>
          <span class="flow-expand-caret">{{
            flowStore.expandedNodeId === node.id
              ? flowRailCollapseLabel()
              : flowRailExpandLabel()
          }}</span>
        </div>
      </button>
      <div class="flow-step-actions">
        <template v-if="node.step_type === 'offsite' || node.step_type === 'archive'">
          <!-- 说明集中在输入区归档提示；此处不重复上课 -->
        </template>
        <el-button
          v-else
          size="small"
          text
          type="primary"
          @click.stop="restartFromNode(node)"
        >
          {{ flowRailRestartFromHereLabel() }}
        </el-button>
      </div>
      <div v-if="flowStore.expandedNodeId === node.id" class="flow-io">
        <div class="flow-io-block">
          <div class="flow-io-label">{{ flowRailIoInputLabel() }}</div>
          <pre class="flow-io-pre">{{ formatIo(node.input, 'input') }}</pre>
        </div>
        <div v-if="flowRailNodeChangePatch(node)" class="flow-io-block">
          <div class="flow-io-label">{{ flowRailIoDiffLabel() }}</div>
          <pre class="flow-io-pre flow-io-pre--diff">{{ flowRailNodeChangePatch(node) }}</pre>
          <el-button
            size="small"
            type="warning"
            :loading="revertLoadingId === node.id"
            @click.stop="$emit('revert', node)"
          >
            {{ flowRailRevertStepButton() }}
          </el-button>
        </div>
        <div class="flow-io-block">
          <div class="flow-io-label">{{ flowRailIoOutputLabel() }}</div>
          <pre class="flow-io-pre">{{ formatIo(node.output, 'output') }}</pre>
        </div>
        <div v-if="node.journalPath" class="flow-io-path">
          {{ flowRailJournalPathPrefix() }}{{ node.journalPath }}
          <el-button size="small" text type="primary" @click.stop="openNodeJournal(node)">
            {{ flowRailOpenInDocsHub() }}
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  flowRailCollapseLabel,
  flowRailExpandLabel,
  flowRailIoDiffLabel,
  flowRailIoInputLabel,
  flowRailIoOutputLabel,
  flowRailJournalPathPrefix,
  flowRailMetaGatePending,
  flowRailOpenInDocsHub,
  flowRailRevertStepButton,
} from '../composables/flowRailCopy.js'
import {
  flowRailNodeChangePatch,
  flowRailNodeChangeSummary,
} from '../composables/flowRailNodeChange.js'
import { flowRailOpenNodeJournal } from '../composables/flowRailNodeDoc.js'
import { flowRailRestartFromHereLabel } from '../composables/sessionFlowRestartUi.js'
import { useFlowStore } from '../../../stores/flow.js'
import {
  flowAnchorNodeId,
  flowClass,
  formatIo,
  isClonedNode,
  isCurrentOffsiteSegment,
  isFlowHistoryNode,
  offsiteInvokedLabel,
  openDocsHub,
  restartFromNode,
  reviewAction,
  reviewLabel,
  statusLabel,
  stepTypeLabel,
  toggleNodeExpand,
} from '../composables/useSessionDetail'
import FlowRailNodeBadges from './FlowRailNodeBadges.vue'

defineProps({
  node: { type: Object, required: true },
  revertLoadingId: { type: String, default: '' },
})
defineEmits(['revert'])

const flowStore = useFlowStore()

function openNodeJournal(n) {
  flowRailOpenNodeJournal(n, { openDocsHub })
}
</script>

<style scoped>
.flow-step-body {
  min-width: 0;
}

.flow-step-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  color: var(--ecw-text-1, #0d0d0d);
  line-height: 1.35;
}

.flow-idx {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.05);
  font-size: 11px;
  font-weight: 700;
  color: var(--ecw-text-2, #6e6e80);
}

.flow-step.current .flow-idx {
  background: var(--ecw-accent-soft, #ecf5ff);
  color: var(--ecw-accent, #409eff);
}

.flow-step.running .flow-idx {
  background: rgba(0, 122, 255, 0.12);
  color: var(--ecw-accent, #007aff);
}

.flow-step-name {
  min-width: 0;
}

.flow-step-meta {
  font-size: 11.5px;
  color: var(--ecw-text-3, #8e8ea0);
  margin-top: 3px;
  letter-spacing: -0.01em;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.flow-step.is-flow-history {
  opacity: 0.72;
}
.flow-step.is-flow-anchor {
  scroll-margin-block: 12px;
}

.flow-step-actions {
  padding: 0 4px 6px 28px;
}

.flow-step-head {
  display: block;
  width: 100%;
  border: none;
  background: transparent;
  padding: 0;
  text-align: left;
  cursor: pointer;
}

.flow-step-head:hover .flow-step-title {
  color: var(--ecw-accent, #409eff);
}

.flow-expand-caret {
  margin-left: auto;
  font-size: 11px;
  color: var(--ecw-accent, #409eff);
  font-weight: 600;
}

.flow-io {
  margin-top: 10px;
  padding: 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.flow-io-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--ecw-text-3, #8b8f9a);
  margin-bottom: 4px;
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

.flow-io-path {
  font-size: 10.5px;
  color: var(--ecw-text-3, #8b8f9a);
  word-break: break-all;
}

.meta-gate {
  color: var(--ecw-text-3, #8e8ea0);
}

.meta-offsite-member {
  color: var(--el-color-primary, #409eff);
  font-weight: 550;
}

.meta-review.is-pending {
  color: #c45c26;
  font-weight: 600;
}
.meta-review.is-approve {
  color: #2f6f4e;
}
.meta-review.is-reject {
  color: #b42318;
}
</style>
