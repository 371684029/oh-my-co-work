<template>
  <main class="dh-col dh-col-content" :class="readingClasses" :style="readingStyle">
    <DocsHubWelcomePane
      :current="current"
      :file-loading="fileLoading"
      :has-docs="hasDocs"
      @go-workbench="$emit('go-workbench')"
    />

    <template v-if="file && !fileLoading">
      <div class="dh-content-head">
        <div class="dh-content-title-row">
          <h2 class="dh-file-title">{{ fileLabel(file) }}</h2>
          <span class="dh-kind-chip">{{ file.title }}</span>
        </div>
        <div class="dh-content-meta">
          <span v-if="currentSession?.sessionTitle">{{ currentSession.sessionTitle }}</span>
          <span>{{ formatSize(file.size) }}</span>
          <span>{{ formatTime(file.mtimeMs) }}</span>
        </div>
        <p v-if="file.truncated" class="dh-truncated-warn">{{ docsHubTruncatedWarn() }}</p>
      </div>

      <div v-if="inDocSearch && inDocMarkTotal && !editing" class="dh-in-doc-search">
        <span class="dh-in-doc-search-label">{{
          docsHubInDocSearchBanner(inDocSearch.query, inDocSearchLabel)
        }}</span>
        <el-button size="small" @click="stepInDocSearchMark(-1)">{{ docsHubInDocPrevLabel() }}</el-button>
        <el-button size="small" @click="stepInDocSearchMark(1)">{{ docsHubInDocNextLabel() }}</el-button>
        <el-button size="small" link type="info" @click="clearInDocSearch">{{ docsHubInDocCloseLabel() }}</el-button>
      </div>

      <div v-if="!editing" class="dh-reading-bar">
        <el-segmented
          :model-value="readingPrefs.width"
          :options="readingWidthOptions"
          size="small"
          @change="setReadingWidth"
        />
        <el-segmented
          :model-value="readingPrefs.fontScale"
          :options="readingFontOptions"
          size="small"
          @change="setReadingFontScale"
        />
        <el-button size="small" plain @click="toggleReadingTheme">
          {{ docsHubReadingThemeLabel(readingPrefs.theme) }}
        </el-button>
        <el-button
          size="small"
          :type="readingPrefs.focus ? 'primary' : 'default'"
          plain
          @click="toggleReadingFocus"
        >
          {{ docsHubReadingFocusLabel(readingPrefs.focus) }}
        </el-button>
      </div>

      <div class="dh-content-actions">
        <template v-if="canEdit">
          <el-button v-if="!editing" size="small" type="primary" @click="startEdit">
            {{ docsHubEditLabel() }}
          </el-button>
          <template v-else>
            <el-button size="small" type="primary" :loading="saving" @click="save">
              {{ docsHubSaveLabel() }}
            </el-button>
            <el-button size="small" :disabled="saving" @click="cancelEdit">{{ docsHubCancelLabel() }}</el-button>
          </template>
        </template>
        <span v-else class="dh-readonly-hint">{{ docsHubReadonlyHint() }}</span>
        <el-button
          v-if="!editing && file"
          size="small"
          :type="codeLineNumbers ? 'primary' : 'default'"
          plain
          @click="toggleCodeLineNumbers"
        >
          {{ docsHubCodeLineNumbersLabel() }}
        </el-button>
        <el-button
          v-if="current && file && !editing"
          size="small"
          plain
          :type="isCurrentPinned() ? 'primary' : 'default'"
          @click="pinCurrentDoc"
        >
          {{ docsHubPinDocLabel(isCurrentPinned()) }}
        </el-button>
        <el-button v-if="file && !editing" size="small" plain @click="onExportHtml">
          {{ docsHubExportHtmlLabel() }}
        </el-button>
        <el-button v-if="file && !editing" size="small" plain @click="onExportPrint">
          {{ docsHubExportPdfLabel() }}
        </el-button>
      </div>

      <div
        v-if="!editing"
        ref="contentScrollRef"
        class="dh-content doc-prose"
        @click="onContentClick"
        v-html="renderedHtml"
      />

      <nav v-if="docOutline.length && !editing" class="dh-outline" :aria-label="docsHubOutlineAria()">
        <div class="dh-outline-title">{{ docsHubOutlineTitle() }}</div>
        <button
          v-for="item in docOutline"
          :key="item.slug"
          type="button"
          class="dh-outline-item"
          :class="{ active: activeOutlineSlug === item.slug, [`level-${item.level}`]: true }"
          @click="scrollToHeading(item.slug)"
        >
          {{ item.text }}
        </button>
      </nav>

      <!-- v-else pairs with outline nav (same as DocsHub.vue) -->
      <div v-else-if="editing" class="dh-editor-split">
        <el-input
          v-model="draft"
          type="textarea"
          class="dh-editor"
          :autosize="{ minRows: 12, maxRows: 42 }"
          :placeholder="docsHubEditPlaceholder()"
        />
        <div
          class="dh-editor-preview doc-prose"
          :class="readingClasses"
          :style="readingStyle"
          v-html="draftPreviewHtml"
        />
      </div>
    </template>
  </main>
</template>

<script setup>
import { ref, watch, nextTick, onUnmounted } from 'vue'
import ElMessage from 'element-plus/es/components/message/index.mjs'
import { handleDocsProseClick } from './docsCodeFence.js'
import {
  applyInDocSearchMarks,
  clearInDocSearchMarks,
  scrollToInDocSearchMark,
} from './docsInDocSearch.js'
import {
  current,
  file,
  fileLoading,
  editing,
  draft,
  saving,
  currentSession,
  canEdit,
  renderedHtml,
  docOutline,
  codeLineNumbers,
  toggleCodeLineNumbers,
  readingPrefs,
  readingClasses,
  readingStyle,
  readingWidthOptions,
  readingFontOptions,
  setReadingWidth,
  setReadingFontScale,
  toggleReadingTheme,
  toggleReadingFocus,
  inDocSearch,
  inDocMarkTotal,
  inDocSearchLabel,
  clearInDocSearch,
  setInDocMarkTotal,
  stepInDocSearchMark,
  formatSize,
  formatTime,
  fileLabel,
  selectFile,
  startEdit,
  cancelEdit,
  save,
  resolveDocLink,
  openPath,
  pinCurrentDoc,
  isCurrentPinned,
  draftPreviewHtml,
} from '../workbench/composables/useDocsHub'
import { buildDocExportHtml, downloadTextFile, openDocPrintWindow } from './docsExport.js'
import proseCss from './docProse.css?raw'
import DocsHubWelcomePane from './DocsHubWelcomePane.vue'
import {
  createDocOutlineObserver,
  initialOutlineSlug,
  listDocHeadingElements,
  scrollDocHeading,
} from './docsHubOutlineUi.js'
import {
  docsCopyAnchorFallbackMessage,
  docsCopyAnchorSuccessMessage,
  docsCopyCodeFailedMessage,
  docsCopyCodeSuccessMessage,
  docsLinkResolveFailedMessage,
  docsPrintPopupBlockedMessage,
} from './docsHubMessages.js'
import {
  docsHubOutlineAria,
  docsHubOutlineTitle,
  docsHubReadingThemeLabel,
  docsHubReadingFocusLabel,
  docsHubEditLabel,
  docsHubSaveLabel,
  docsHubCancelLabel,
  docsHubReadonlyHint,
  docsHubCodeLineNumbersLabel,
  docsHubPinDocLabel,
  docsHubExportHtmlLabel,
  docsHubExportPdfLabel,
  docsHubInDocPrevLabel,
  docsHubInDocNextLabel,
  docsHubInDocCloseLabel,
  docsHubInDocSearchBanner,
  docsHubTruncatedWarn,
  docsHubEditPlaceholder,
} from './docsHubCopy.js'

const props = defineProps({
  hasDocs: { type: Boolean, default: false },
  expandFor: { type: Function, required: true },
})

defineEmits(['go-workbench'])

function onExportHtml() {
  if (!file.value) return
  const html = buildDocExportHtml({
    title: fileLabel(file.value),
    bodyHtml: renderedHtml.value,
    proseCss,
  })
  const base = (file.value.name || 'doc').replace(/[^\w.-]+/g, '_')
  downloadTextFile(`${base}.html`, html)
}

function onExportPrint() {
  if (!file.value) return
  const html = buildDocExportHtml({
    title: fileLabel(file.value),
    bodyHtml: renderedHtml.value,
    proseCss,
  })
  if (!openDocPrintWindow(html)) ElMessage.warning(docsPrintPopupBlockedMessage())
}

const contentScrollRef = ref(null)
const activeOutlineSlug = ref('')
let outlineObserver = null

function scrollToHeading(slug) {
  const root = contentScrollRef.value
  if (scrollDocHeading(root, slug)) activeOutlineSlug.value = slug
}

async function copyHeadingAnchor(slug) {
  if (!slug) return
  const hash = `#${slug}`
  try {
    await navigator.clipboard.writeText(hash)
    ElMessage.success(docsCopyAnchorSuccessMessage())
  } catch {
    ElMessage.success(docsCopyAnchorFallbackMessage(hash))
  }
}

function teardownOutlineObserver() {
  if (outlineObserver) {
    outlineObserver.disconnect()
    outlineObserver = null
  }
  activeOutlineSlug.value = ''
}

function setupOutlineObserver() {
  teardownOutlineObserver()
  const root = contentScrollRef.value
  if (!root || !docOutline.value.length) return
  const headings = listDocHeadingElements(root)
  outlineObserver = createDocOutlineObserver(root, (slug) => {
    activeOutlineSlug.value = slug
  })
  if (!activeOutlineSlug.value) activeOutlineSlug.value = initialOutlineSlug(headings)
}

function syncInDocSearchHighlights() {
  const root = contentScrollRef.value
  if (!root || editing.value || !inDocSearch.value) {
    clearInDocSearchMarks(root)
    setInDocMarkTotal(0)
    return
  }
  const total = applyInDocSearchMarks(root, inDocSearch.value.query)
  setInDocMarkTotal(total)
  if (!total) return
  scrollToInDocSearchMark(root, {
    markIndex: inDocSearch.value.markIndex,
    lineHint: inDocSearch.value.lineHint,
    content: file.value?.content,
    query: inDocSearch.value.query,
  })
}

watch([renderedHtml, file, inDocSearch, editing], () => {
  nextTick(() => syncInDocSearchHighlights())
})

watch(
  () => inDocSearch.value?.markIndex,
  () => {
    nextTick(() => {
      const root = contentScrollRef.value
      if (!root || !inDocSearch.value) return
      scrollToInDocSearchMark(root, {
        markIndex: inDocSearch.value.markIndex,
        lineHint: inDocSearch.value.lineHint,
        content: file.value?.content,
        query: inDocSearch.value.query,
      })
    })
  },
)

watch([file, editing, renderedHtml], () => {
  if (editing.value || !file.value) {
    teardownOutlineObserver()
    return
  }
  nextTick(() => setupOutlineObserver())
})

async function onContentClick(e) {
  const handled = await handleDocsProseClick(e, {
    onCopied: () => ElMessage.success(docsCopyCodeSuccessMessage()),
    onCopyFailed: () => ElMessage.warning(docsCopyCodeFailedMessage()),
  })
  if (handled) return

  const headingEl = e.target.closest('.docs-heading-anchor')
  if (headingEl?.id) {
    copyHeadingAnchor(headingEl.id)
    return
  }
  const pathEl = e.target.closest('.docs-path-link')
  if (pathEl) {
    e.preventDefault()
    openPath(pathEl.getAttribute('data-docs-path'))
    return
  }
  const docEl = e.target.closest('.docs-doc-link')
  if (docEl) {
    e.preventDefault()
    const r = resolveDocLink(docEl.getAttribute('data-docs-link'))
    if (r) {
      props.expandFor(r.sessionId)
      selectFile(r.sessionId, r.name)
    } else {
      ElMessage.warning(docsLinkResolveFailedMessage())
    }
  }
}

onUnmounted(() => {
  teardownOutlineObserver()
  clearInDocSearchMarks(contentScrollRef.value)
})
</script>

<style scoped>
.dh-col {
  border: 0.5px solid rgba(255, 255, 255, 0.65);
  border-radius: var(--ecw-radius-xl, 16px);
  background: var(--ecw-glass-strong, rgba(255, 255, 255, 0.8));
  backdrop-filter: saturate(160%) blur(36px);
  -webkit-backdrop-filter: saturate(160%) blur(36px);
  box-shadow: var(--ecw-shadow-md, 0 4px 16px rgba(0, 0, 0, 0.05));
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dh-col-content {
  flex: 1;
  min-width: 0;
  padding: 20px 24px 28px;
  background: rgba(255, 255, 255, 0.88);
  position: relative;
}

.dh-outline {
  position: absolute;
  top: 24px;
  right: 12px;
  width: 168px;
  max-height: calc(100% - 48px);
  overflow-y: auto;
  padding: 10px 8px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  font-size: 11.5px;
  line-height: 1.35;
  z-index: 2;
}

.dh-outline-title {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ecw-text-3, #86868b);
  margin-bottom: 6px;
  padding: 0 4px;
}

.dh-outline-item {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 4px 6px;
  border-radius: 6px;
  color: var(--ecw-text-2, #6e6e73);
  cursor: pointer;
}

.dh-outline-item.level-2 {
  padding-left: 14px;
}

.dh-outline-item.level-3 {
  padding-left: 22px;
  font-size: 11px;
}

.dh-outline-item:hover,
.dh-outline-item.active {
  background: rgba(0, 122, 255, 0.1);
  color: #007aff;
}

.doc-prose :deep(.docs-heading-anchor) {
  scroll-margin-top: 12px;
  cursor: pointer;
}

.dh-in-doc-search {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  max-width: 860px;
  width: 100%;
  margin: 0 auto 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 200, 0, 0.12);
  border: 1px solid rgba(255, 180, 0, 0.35);
  font-size: 12px;
}

.dh-in-doc-search-label {
  flex: 1;
  min-width: 120px;
  color: var(--ecw-text-2, #6e6e73);
}

.doc-prose :deep(mark.docs-search-hit) {
  background: rgba(255, 200, 0, 0.45);
  border-radius: 2px;
  padding: 0 1px;
}

.doc-prose :deep(mark.docs-search-hit-active) {
  background: rgba(255, 140, 0, 0.55);
  outline: 1px solid rgba(255, 120, 0, 0.8);
}

.dh-reading-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  max-width: 860px;
  width: 100%;
  margin: 0 auto 10px;
  padding: 0 8px;
}

.dh-col-content.docs-read-width-narrow .dh-content-head,
.dh-col-content.docs-read-width-narrow .dh-content,
.dh-col-content.docs-read-width-narrow .dh-content-actions,
.dh-col-content.docs-read-width-narrow .dh-reading-bar,
.dh-col-content.docs-read-width-narrow .dh-outline {
  max-width: 640px;
}

.dh-col-content.docs-read-width-wide .dh-content-head,
.dh-col-content.docs-read-width-wide .dh-content,
.dh-col-content.docs-read-width-wide .dh-content-actions,
.dh-col-content.docs-read-width-wide .dh-reading-bar {
  max-width: 1080px;
}

.dh-col-content.docs-read-focus {
  position: fixed;
  inset: 0;
  z-index: 2000;
  overflow: auto;
  padding: 28px 32px;
}

.dh-col-content.docs-read-theme-dark {
  background: #1a1b1e;
}

.dh-col-content.docs-read-theme-dark .dh-file-title,
.dh-col-content.docs-read-theme-dark .doc-prose {
  color: #e8eaed;
}

.dh-col-content.docs-read-theme-dark .doc-prose code {
  background: rgba(255, 255, 255, 0.08);
}

.dh-col-content.docs-read-theme-dark .doc-prose .docs-code-block {
  border-color: rgba(255, 255, 255, 0.12);
}

.dh-col-content .doc-prose {
  font-size: calc(16px * var(--docs-font-scale, 1));
}

.dh-content-head {
  max-width: 860px;
  width: 100%;
  margin: 0 auto 12px;
  padding: 0 8px 12px;
}

.dh-content-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dh-file-title {
  margin: 0;
  font-size: 26px;
  font-weight: 600;
  line-height: 1.35;
  color: #1f2329;
}

.dh-kind-chip {
  flex-shrink: 0;
  padding: 0 5px;
  border-radius: 3px;
  background: rgba(143, 149, 158, 0.15);
  color: #646a73;
  font-size: 10px;
  line-height: 16px;
}

.dh-content-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--ecw-text-3, #86868b);
}

.dh-content-meta span + span::before {
  content: '·';
  margin-right: 12px;
  color: #c5c5c7;
}

.dh-content-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.dh-readonly-hint {
  font-size: 12px;
  color: var(--ecw-text-3, #86868b);
}

.dh-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  font-size: 16px;
  max-width: 860px;
  width: 100%;
  margin: 0 auto;
  padding: 4px 8px 32px;
}

.dh-editor-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 8px 16px;
  min-height: 320px;
}

.dh-editor-preview {
  border: 0.5px solid var(--ecw-border, rgba(0, 0, 0, 0.06));
  border-radius: 10px;
  padding: 12px 14px;
  overflow: auto;
  max-height: 70vh;
  background: var(--ecw-surface-solid, #fff);
}

@media (max-width: 960px) {
  .dh-editor-split {
    grid-template-columns: 1fr;
  }
}

.dh-editor :deep(.el-textarea__inner) {
  border-radius: 10px;
  font-size: 13.5px;
  line-height: 1.6;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
}
</style>
