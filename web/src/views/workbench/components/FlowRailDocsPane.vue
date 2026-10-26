<template>
  <div class="wb-right-pane docs-pane">
    <div class="docs-rail-toolbar">
      <div class="docs-rail-title-wrap">
        <AppLogo size="sm" class="docs-rail-logo" />
        <span class="docs-rail-title">{{ flowRailDocsRailTitle() }}</span>
      </div>
      <div class="docs-rail-actions">
        <el-button
          type="primary"
          size="small"
          :disabled="!activeId"
          @click="openDocsHub()"
        >
          {{ flowRailDocsExpandFull() }}
        </el-button>
        <el-dropdown trigger="click" class="docs-rail-more">
          <el-button size="small" plain :disabled="!activeId">{{ flowRailDocsMore() }}</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item :disabled="!activeId" @click="openDocsHub({ newTab: true })">
                {{ flowRailDocsNewTab() }}
              </el-dropdown-item>
              <el-dropdown-item
                v-if="detail?.session?.group_id"
                :disabled="!activeId || exportingRailDocs"
                @click="onExportRailGroupDocs"
              >
                {{ flowRailDocsExportGroup() }}
              </el-dropdown-item>
              <el-dropdown-item
                :disabled="!activeId || announceOpenLoading"
                @click="openAnnouncementMd"
              >
                {{ flowRailDocsOpenSystem() }}
              </el-dropdown-item>
              <el-dropdown-item
                :disabled="!activeId || announceLoading"
                @click="rebuildAnnouncement"
              >
                {{ flowRailDocsRefreshReport() }}
              </el-dropdown-item>
              <el-dropdown-item :disabled="!activeId || railDocsLoading" @click="loadRailDocs">
                {{ flowRailDocsRefreshList() }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <div v-if="detail && activeId" class="docs-rail-body">
      <!-- 文件选项列表 -->
      <FlowRailDocsFiles
        :files="railDocFiles"
        :loading="railDocsLoading"
        :selected-name="selectedDocName"
        @select="onDocsFileSelect"
      />

      <!-- 正文阅读区 -->
      <div v-if="selectedDocContent" class="docs-rail-content-wrap">
        <div class="docs-rail-file-header">
          <span class="file-header-name">{{ selectedDocName }}</span>
          <span v-if="selectedDocName.includes('step')" class="file-header-badge">{{
            flowRailDocsAuditReadonlyBadge()
          }}</span>
        </div>
        <div
          class="docs-rail-content doc-prose"
          :class="railReadingClasses"
          :style="railReadingStyle"
          v-html="renderedDocHtml"
          @click="onRailContentClick"
        />
      </div>
      <div v-else-if="selectedDocLoading" class="docs-rail-empty">
        {{ flowRailDocsLoading() }}
      </div>

      <FlowRailDocsNotes />
    </div>

    <EmptyState
      v-else
      :title="flowRailDocsEmptyTitle()"
      :description="flowRailDocsEmptyDescription()"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import ElMessage from 'element-plus/es/components/message/index.mjs'
import { t } from '../../../i18n/index.js'
import AppLogo from '../../../components/AppLogo.vue'
import EmptyState from '../../../components/ui/EmptyState.vue'
import { api } from '../../../api'
import '../../docs/docProse.css'
import { createDocsMarkdown } from '../../docs/markdownRenderer'
import { handleDocsProseClick, readDocsCodeLineNumbers } from '../../docs/docsCodeFence.js'
import { getDocsList, subscribeDocsList } from '../../docs/docsListStore.js'
import {
  docsReadingClassNames,
  docsReadingStyle,
  readDocsReadingPrefs,
} from '../../docs/docsReadingPrefs.js'
import { openPath } from '../composables/useDocsHub'
import { recordDocsOpen } from '../../docs/docsReadingHistory.js'
import {
  flowRailDocsAuditReadonlyBadge,
  flowRailDocsEmptyDescription,
  flowRailDocsEmptyTitle,
  flowRailDocsExpandFull,
  flowRailDocsExportGroup,
  flowRailDocsLoading,
  flowRailDocsMore,
  flowRailDocsNewTab,
  flowRailDocsOpenSystem,
  flowRailDocsRailTitle,
  flowRailDocsRefreshList,
  flowRailDocsRefreshReport,
} from '../composables/flowRailCopy.js'
import { flowRailResolveDocLink } from '../composables/flowRailDocLink.js'
import { createFlowRailDocsRailActions } from '../composables/flowRailDocsRailActions.js'
import { useFlowStore } from '../../../stores/flow.js'
import {
  activeId,
  announceLoading,
  announceOpenLoading,
  detail,
  openAnnouncementMd,
  openDocsHub,
  rebuildAnnouncement,
  sessionGroupFolder,
} from '../composables/useSessionDetail'
import FlowRailDocsFiles from './FlowRailDocsFiles.vue'
import FlowRailDocsNotes from './FlowRailDocsNotes.vue'

const flowStore = useFlowStore()
const railDocFiles = ref([])
const railDocsLoading = ref(false)
const selectedDocName = ref('')
const selectedDocContent = ref('')
const selectedDocLoading = ref(false)
const exportingRailDocs = ref(false)

const { loadRailDocs, onSelectRailDoc, onExportRailGroupDocs } = createFlowRailDocsRailActions({
  activeId,
  detail,
  api,
  getDocsList,
  recordDocsOpen,
  railDocFiles,
  railDocsLoading,
  selectedDocName,
  selectedDocContent,
  selectedDocLoading,
  exportingRailDocs,
})

const md = computed(() =>
  createDocsMarkdown({
    workFolders: [sessionGroupFolder.value].filter(Boolean),
  }),
)

const railReadingPrefs = readDocsReadingPrefs()
const railReadingClasses = docsReadingClassNames(railReadingPrefs)
const railReadingStyle = docsReadingStyle(railReadingPrefs)

const renderedDocHtml = computed(() => {
  if (!selectedDocContent.value) return ''
  return md.value.render(selectedDocContent.value, {
    docCodeLineNumbers: readDocsCodeLineNumbers(),
    docSessionId: activeId.value,
    docRelName: selectedDocName.value,
  })
})

let stopDocsListSub = null
onMounted(() => {
  stopDocsListSub = subscribeDocsList((sessionId) => {
    if (sessionId !== activeId.value || flowStore.rightTab !== 'docs') return
    loadRailDocs()
    if (selectedDocName.value) onSelectRailDoc(selectedDocName.value)
  })
})
onUnmounted(() => {
  stopDocsListSub?.()
  stopDocsListSub = null
})

function onDocsFileSelect(name) {
  selectedDocName.value = name
  onSelectRailDoc(name)
}

async function onRailContentClick(e) {
  const handled = await handleDocsProseClick(e, {
    onCopied: () => ElMessage.success(t('docsHub.copyCodeSuccess')),
    onCopyFailed: () => ElMessage.warning(t('docsHub.copyCodeFailed')),
  })
  if (handled) return

  const pathEl = e.target.closest?.('.docs-path-link')
  if (pathEl) {
    e.preventDefault()
    openPath(pathEl.getAttribute('data-docs-path'))
    return
  }
  const docEl = e.target.closest?.('.docs-doc-link')
  if (docEl) {
    e.preventDefault()
    const r = flowRailResolveDocLink(docEl.getAttribute('data-docs-link'), activeId.value)
    if (r) onSelectRailDoc(r.name)
    else ElMessage.warning(t('docsHub.linkResolveFailed'))
  }
}

watch(
  [activeId, () => flowStore.rightTab],
  ([newId, newTab]) => {
    if (newTab === 'docs' && newId) {
      loadRailDocs()
    }
  },
  { immediate: true },
)

watch(
  () => flowStore.railDocFocus,
  async (req) => {
    if (!req?.sessionId || !req?.name) return
    if (req.sessionId !== activeId.value) return
    flowStore.rightTab = 'docs'
    await loadRailDocs()
    await onSelectRailDoc(req.name)
  },
)
</script>

<style scoped>
.docs-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.docs-rail-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 10px;
  gap: 8px;
  flex-shrink: 0;
}

.docs-rail-title-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 auto;
  margin-right: auto;
}

.docs-rail-logo {
  flex-shrink: 0;
}

.docs-rail-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--ecw-text-1, #1d1d1f);
  writing-mode: horizontal-tb;
  white-space: normal;
  word-break: break-word;
}

.docs-rail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}

.docs-rail-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  container-type: inline-size;
  container-name: docs-rail;
}

.docs-rail-content-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 10px 14px 4px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #eceef0;
}

.docs-rail-file-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 6px;
  margin-bottom: 6px;
  flex-shrink: 0;
}

.file-header-name {
  font-size: 11px;
  color: #8f959e;
}

.file-header-badge {
  font-size: 10px;
  color: #8f959e;
}

.docs-rail-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: 20px;
  font-size: 14.5px;
}

.docs-rail-empty {
  padding: 30px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--ecw-text-3, #86868b);
}
</style>
