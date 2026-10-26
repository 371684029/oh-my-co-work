<template>
  <div class="docs-rail-notes">
    <div class="docs-rail-notes-title">{{ flowRailDocsNotesTitle() }}</div>
    <el-input
      v-model="sessionNotesDraft"
      type="textarea"
      :rows="3"
      maxlength="2000"
      show-word-limit
      :placeholder="flowRailDocsNotesPlaceholder()"
      :disabled="!activeId || notesSaving"
    />
    <div class="docs-rail-notes-actions">
      <el-button
        size="small"
        type="primary"
        :loading="notesSaving"
        :disabled="!activeId"
        @click="saveSessionNotes"
      >
        {{ flowRailDocsSaveNotes() }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
import {
  flowRailDocsNotesPlaceholder,
  flowRailDocsNotesTitle,
  flowRailDocsSaveNotes,
} from '../composables/flowRailCopy.js'
import {
  activeId,
  notesSaving,
  saveSessionNotes,
  sessionNotesDraft,
} from '../composables/useSessionDetail'
</script>

<style scoped>
.docs-rail-notes {
  flex-shrink: 0;
  padding-top: 4px;
}

.docs-rail-notes-title {
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ecw-text-3, #86868b);
  margin-bottom: 8px;
  writing-mode: horizontal-tb;
  white-space: normal;
  word-break: break-word;
}

.docs-rail-notes-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
</style>
