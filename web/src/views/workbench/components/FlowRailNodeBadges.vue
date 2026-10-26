<template>
  <el-button
    v-if="flowRailNodeDocFile(node)"
    size="small"
    text
    type="primary"
    class="flow-node-doc-btn"
    @click.stop="$emit('open-journal', node)"
  >
    {{ flowRailJournalButton() }}
  </el-button>
  <el-tag
    v-if="nodeHasAdapt(node)"
    size="small"
    type="warning"
    effect="plain"
    round
  >
    {{ flowRailTagAdapt() }}
  </el-tag>
  <el-tag
    v-if="nodeHasRefine(node)"
    size="small"
    type="success"
    effect="plain"
    round
  >
    {{ flowRailTagRefine() }}
  </el-tag>
  <el-tag
    v-if="node.step_type === 'offsite'"
    size="small"
    type="warning"
    effect="plain"
    round
  >
    {{ flowRailTagOffsite() }}
  </el-tag>
  <el-tag
    v-else-if="node.step_type === 'archive'"
    size="small"
    type="info"
    effect="plain"
    round
  >
    {{ flowRailTagArchive() }}
  </el-tag>
  <el-tag
    v-else-if="isClonedNode(node)"
    size="small"
    type="success"
    effect="plain"
    round
  >
    {{ flowRailTagClone() }}
  </el-tag>
  <el-tag
    v-if="isCurrentOffsiteSegment(node)"
    size="small"
    type="warning"
    effect="dark"
    round
  >
    {{ flowRailTagCurrentSegment() }}
  </el-tag>
  <el-tag
    v-if="node.step_type === 'offsite' && node.output?.archived"
    size="small"
    type="info"
    effect="plain"
    round
  >
    {{ flowRailTagOffsiteArchived() }}
  </el-tag>
  <el-tag
    v-else-if="offsiteEntryLabel(node)"
    size="small"
    type="warning"
    effect="plain"
    round
  >
    {{ offsiteEntryLabel(node) }}
  </el-tag>
  <el-tag
    v-else-if="node.step_type !== 'offsite' && node.status === 'skipped'"
    size="small"
    type="info"
    effect="plain"
    round
  >
    {{ nodeBypassed(node) ? flowRailSkippedBypassed() : flowRailSkipped() }}
  </el-tag>
  <el-tag
    v-else-if="node.step_type !== 'offsite' && node.status === 'waiting_human' && isCurrent(node)"
    size="small"
    type="danger"
    effect="dark"
    round
  >
    {{ flowRailWaitingHuman() }}
  </el-tag>
  <el-tag
    v-else-if="node.step_type !== 'offsite' && node.status === 'waiting_human'"
    size="small"
    type="info"
    effect="plain"
    round
  >
    {{ flowRailSuspended() }}
  </el-tag>
  <el-tag
    v-else-if="node.step_type !== 'offsite' && isCurrent(node) && node.status === 'pending'"
    size="small"
    type="info"
    effect="plain"
    round
  >
    {{ flowRailPending() }}
  </el-tag>
  <el-tag
    v-else-if="node.step_type !== 'offsite' && isCurrent(node)"
    size="small"
    type="primary"
    effect="light"
    round
  >
    {{ flowRailCurrent() }}
  </el-tag>
</template>

<script setup>
import {
  flowRailCurrent,
  flowRailJournalButton,
  flowRailPending,
  flowRailSkipped,
  flowRailSkippedBypassed,
  flowRailSuspended,
  flowRailTagAdapt,
  flowRailTagArchive,
  flowRailTagClone,
  flowRailTagCurrentSegment,
  flowRailTagOffsite,
  flowRailTagOffsiteArchived,
  flowRailTagRefine,
  flowRailWaitingHuman,
} from '../composables/flowRailCopy.js'
import { flowRailNodeDocFile } from '../composables/flowRailNodeDoc.js'
import {
  isClonedNode,
  isCurrent,
  isCurrentOffsiteSegment,
  nodeBypassed,
  nodeHasAdapt,
  nodeHasRefine,
  offsiteEntryLabel,
} from '../composables/useSessionDetail'

defineProps({
  node: { type: Object, required: true },
})
defineEmits(['open-journal'])
</script>
