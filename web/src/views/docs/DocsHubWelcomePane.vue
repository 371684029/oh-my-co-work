<template>
  <div
    v-if="!current"
    class="dh-welcome-pane"
    role="region"
    :aria-label="docsHubWelcomeRegionAria()"
  >
    <div class="dh-welcome-hero">
      <h2 class="dh-welcome-title" id="docs-welcome-title">
        {{ hasDocs ? docsHubWelcomeSelectTitle() : docsHubWelcomeEmptyTitle() }}
      </h2>
      <p class="dh-welcome-desc">
        {{ hasDocs ? docsHubWelcomeSelectDesc() : docsHubWelcomeEmptyDesc() }}
      </p>
      <div v-if="!hasDocs" class="dh-welcome-actions">
        <el-button type="primary" @click="$emit('go-workbench')">
          {{ docsHubGoWorkbenchLabel() }}
        </el-button>
        <p class="dh-welcome-tip">
          {{ docsHubWelcomeEmptyTip() }}
        </p>
      </div>
    </div>
  </div>
  <div
    v-else-if="fileLoading"
    class="dh-welcome-pane"
    role="status"
    :aria-label="docsHubLoadingFile()"
  >
    <p class="dh-welcome-desc">{{ docsHubLoadingFile() }}</p>
  </div>
</template>

<script setup>
import {
  docsHubGoWorkbenchLabel,
  docsHubLoadingFile,
  docsHubWelcomeEmptyDesc,
  docsHubWelcomeEmptyTip,
  docsHubWelcomeEmptyTitle,
  docsHubWelcomeRegionAria,
  docsHubWelcomeSelectDesc,
  docsHubWelcomeSelectTitle,
} from './docsHubCopy.js'

defineProps({
  current: { type: Object, default: null },
  fileLoading: { type: Boolean, default: false },
  hasDocs: { type: Boolean, default: false },
})

defineEmits(['go-workbench'])
</script>

<style scoped>
.dh-welcome-pane {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 32px;
}

.dh-welcome-hero {
  text-align: center;
  max-width: 400px;
}

.dh-welcome-title {
  margin: 0 0 8px;
  font-size: 17px;
  font-weight: 650;
  color: var(--ecw-text-1, #1d1d1f);
}

.dh-welcome-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--ecw-text-2, #6e6e73);
}

.dh-welcome-actions {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.dh-welcome-tip {
  margin: 0;
  font-size: 12px;
  color: var(--ecw-text-3, #86868b);
}
</style>
