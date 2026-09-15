<template>
  <aside class="wb-right">
    <div class="wb-right-tabs">
      <button
        type="button"
        class="wb-right-tab"
        :class="{ active: flowStore.rightTab === 'flow' }"
        @click="flowStore.rightTab = 'flow'"
      >
        流程
      </button>
      <button
        type="button"
        class="wb-right-tab"
        :class="{ active: isDocsHubTab }"
        @click="flowStore.rightTab = 'docs'"
      >
        文档中心
      </button>
    </div>

    <!-- Tab：流程（适配步骤直接在节点标题上打「适配」角标，不再单开筛选 Tab） -->
    <div v-show="flowStore.rightTab === 'flow'" class="wb-right-pane">
      <p v-if="detail?.session?.status === 'archived'" class="flow-archive-hint">
        已归档
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
        临时协助进行中
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
                  ? `收起 ${entry.nodes.length} 个未执行的废弃步骤`
                  : `${entry.nodes.length} 个未执行的废弃步骤已折叠`
              }}</span>
            </button>
          </div>
          <template v-if="entry.type !== 'skipped' || isSkippedFlowGroupExpanded(entry)">
            <div
              v-for="n in entry.nodes"
              :key="n.id"
              :data-flow-node-id="n.id"
              class="flow-step"
              :class="[
                flowClass(n),
                {
                  open: flowStore.expandedNodeId === n.id,
                  'is-extra': n.step_type === 'offsite',
                  'is-offsite-current': isCurrentOffsiteSegment(n),
                  'is-offsite-archived': n.step_type === 'offsite' && !!n.output?.archived,
                  'is-flow-history': isFlowHistoryNode(n),
                  'is-cloned': isClonedNode(n),
                  'is-flow-anchor': n.id === flowAnchorNodeId,
                },
              ]"
            >
              <div class="flow-dot" aria-hidden="true" />
              <div class="flow-step-body">
                <button type="button" class="flow-step-head" @click="toggleNodeExpand(n)">
                  <div class="flow-step-title">
                    <span
                      class="flow-idx"
                      :class="{ 'flow-idx--extra': n.step_type === 'offsite' }"
                      >{{ n.step_index + 1 }}</span
                    >
                    <span class="flow-step-name">{{ n.title }}</span>
                    <el-tag
                      v-if="nodeHasAdapt(n)"
                      size="small"
                      type="warning"
                      effect="plain"
                      round
                    >
                      适配
                    </el-tag>
                    <el-tag
                      v-if="nodeHasRefine(n)"
                      size="small"
                      type="success"
                      effect="plain"
                      round
                    >
                      炼化
                    </el-tag>
                    <el-tag
                      v-if="n.step_type === 'offsite'"
                      size="small"
                      type="warning"
                      effect="plain"
                      round
                    >
                      临时
                    </el-tag>
                    <el-tag
                      v-else-if="n.step_type === 'archive'"
                      size="small"
                      type="info"
                      effect="plain"
                      round
                    >
                      归档
                    </el-tag>
                    <el-tag
                      v-else-if="isClonedNode(n)"
                      size="small"
                      type="success"
                      effect="plain"
                      round
                    >
                      克隆
                    </el-tag>
                    <el-tag
                      v-if="isCurrentOffsiteSegment(n)"
                      size="small"
                      type="warning"
                      effect="dark"
                      round
                    >
                      当前段
                    </el-tag>
                    <el-tag
                      v-if="n.step_type === 'offsite' && n.output?.archived"
                      size="small"
                      type="info"
                      effect="plain"
                      round
                    >
                      已归档
                    </el-tag>
                    <el-tag
                      v-else-if="offsiteEntryLabel(n)"
                      size="small"
                      type="warning"
                      effect="plain"
                      round
                    >
                      {{ offsiteEntryLabel(n) }}
                    </el-tag>
                    <el-tag
                      v-else-if="n.step_type !== 'offsite' && n.status === 'skipped'"
                      size="small"
                      type="info"
                      effect="plain"
                      round
                    >
                      {{ nodeBypassed(n) ? '已绕过' : '跳过' }}
                    </el-tag>
                    <el-tag
                      v-else-if="n.step_type !== 'offsite' && n.status === 'waiting_human' && isCurrent(n)"
                      size="small"
                      type="danger"
                      effect="dark"
                      round
                    >
                      待确认
                    </el-tag>
                    <el-tag
                      v-else-if="n.step_type !== 'offsite' && n.status === 'waiting_human'"
                      size="small"
                      type="info"
                      effect="plain"
                      round
                    >
                      已挂起
                    </el-tag>
                    <el-tag
                      v-else-if="n.step_type !== 'offsite' && isCurrent(n) && n.status === 'pending'"
                      size="small"
                      type="info"
                      effect="plain"
                      round
                    >
                      待跑
                    </el-tag>
                    <el-tag
                      v-else-if="n.step_type !== 'offsite' && isCurrent(n)"
                      size="small"
                      type="primary"
                      effect="light"
                      round
                    >
                      当前
                    </el-tag>
                  </div>
                  <div class="flow-step-meta">
                    {{ stepTypeLabel(n.step_type) }} · {{ statusLabel(n.status) || n.status }}
                    <span v-if="offsiteInvokedLabel(n)" class="meta-offsite-member">
                      · {{ offsiteInvokedLabel(n) }}
                    </span>
                    <span v-if="reviewLabel(n)" class="meta-review" :class="'is-' + reviewAction(n)">
                      · {{ reviewLabel(n) }}
                    </span>
                    <span v-if="n.gate" class="meta-gate"> · 待确认</span>
                    <span class="flow-expand-caret">{{
                      flowStore.expandedNodeId === n.id ? '收起' : '展开'
                    }}</span>
                  </div>
                </button>
                <div class="flow-step-actions">
                  <template v-if="n.step_type === 'offsite' || n.step_type === 'archive'">
                    <!-- 说明集中在输入区归档提示；此处不重复上课 -->
                  </template>
                  <el-button
                    v-else
                    size="small"
                    text
                    type="primary"
                    @click.stop="restartFromNode(n)"
                  >
                    从这里继续
                  </el-button>
                </div>
                <div v-if="flowStore.expandedNodeId === n.id" class="flow-io">
                  <div class="flow-io-block">
                    <div class="flow-io-label">输入（用户说了啥）</div>
                    <pre class="flow-io-pre">{{ formatIo(n.input, 'input') }}</pre>
                  </div>
                  <div class="flow-io-block">
                    <div class="flow-io-label">输出（做了啥）</div>
                    <pre class="flow-io-pre">{{ formatIo(n.output, 'output') }}</pre>
                  </div>
                  <div v-if="n.journalPath" class="flow-io-path">台账：{{ n.journalPath }}</div>
                </div>
              </div>
            </div>
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
              ? offsiteMode === 'planned'
                ? '临时协助'
                : '临时协助'
              : needsHuman
                ? '待确认'
                : '当前节点'
          }}</span>
          <strong>
            {{
              offsiteActive
                ? activeOffsiteNode?.title || '临时协助'
                : detail.nodes.find((n) => isCurrent(n))?.title ||
                  (detail.session.status === 'archived' ? '已归档（可重开）' : '—')
            }}
          </strong>
        </div>
      </template>
      <div v-else class="flow-empty">
        <p>开聊后显示流程步骤</p>
      </div>
    </div>

    <!-- Tab：文档中心（含原群报告 MD，不再单独占一栏） -->
    <div v-show="isDocsHubTab" class="wb-right-pane docs-pane">
      <div class="docs-rail-toolbar">
        <div class="docs-rail-title-wrap">
          <AppLogo size="sm" class="docs-rail-logo" />
          <span class="docs-rail-title">文档中心</span>
        </div>
        <div class="docs-rail-actions">
          <el-button
            size="small"
            plain
            :disabled="!activeId"
            @click="openDocsHub"
          >
            新标签打开
          </el-button>
          <el-button
            v-if="detail?.session?.group_id"
            size="small"
            plain
            :disabled="!activeId"
            :loading="exportingRailDocs"
            @click="onExportRailGroupDocs"
          >
            导出群
          </el-button>
          <el-button
            size="small"
            text
            :disabled="!activeId"
            :loading="announceOpenLoading"
            :title="announceMdHint"
            @click="openAnnouncementMd"
          >
            系统打开
          </el-button>
          <el-button
            size="small"
            type="primary"
            plain
            :disabled="!activeId"
            :loading="announceLoading"
            @click="rebuildAnnouncement"
          >
            刷新报告
          </el-button>
          <el-button
            size="small"
            type="primary"
            plain
            :disabled="!activeId"
            :loading="railDocsLoading"
            @click="loadRailDocs"
          >
            刷新
          </el-button>
        </div>
      </div>

      <div v-if="detail && activeId" class="docs-rail-body">
        <!-- 文件选项列表 -->
        <div v-if="railDocFiles.length" class="docs-rail-files">
          <button
            v-for="f in railDocFiles"
            :key="f.name"
            type="button"
            class="docs-rail-file-pill"
            :class="{ active: selectedDocName === f.name }"
            @click="onSelectRailDoc(f.name)"
          >
            <span class="pill-name">{{ f.title || f.name }}</span>
            <span class="pill-badge">{{ f.kind === 'announce' ? '报告' : '台账' }}</span>
          </button>
        </div>
        <div v-else-if="!railDocsLoading" class="docs-rail-empty">
          当前会话暂无生成台账或报告
        </div>

        <!-- 正文阅读区 -->
        <div v-if="selectedDocContent" class="docs-rail-content-wrap">
          <div class="docs-rail-file-header">
            <span class="file-header-name">{{ selectedDocName }}</span>
            <span v-if="selectedDocName.includes('step')" class="file-header-badge">审计留痕只读</span>
          </div>
          <div
            class="docs-rail-content"
            v-html="renderedDocHtml"
            @click="onRailContentClick"
          />
        </div>
        <div v-else-if="selectedDocLoading" class="docs-rail-empty">
          读取中…
        </div>

        <div class="docs-rail-notes">
          <div class="docs-rail-notes-title">备注</div>
          <el-input
            v-model="sessionNotesDraft"
            type="textarea"
            :rows="3"
            maxlength="2000"
            show-word-limit
            placeholder="写给自己/团队的备注（不覆盖自动进度）"
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
              保存备注
            </el-button>
          </div>
        </div>
      </div>

      <div v-else class="docs-rail-empty">
        <p>选择会话后查看文档中心</p>
      </div>
    </div>

  </aside>
</template>

<script setup>
import { useFlowStore } from '../../../stores/flow.js'
import {
  detail,
  activeId,
  archiveOutcomeTag,
  offsiteActive,
  offsiteMode,
  activeOffsiteNode,
  needsHuman,
  flowEntries,
  flowAnchorNodeId,
  sessionNotesDraft,
  sessionGroupFolder,
  announceLoading,
  announceOpenLoading,
  notesSaving,
  announceMdHint,
  isSkippedFlowGroupExpanded,
  toggleSkippedFlowGroup,
  flowClass,
  isCurrentOffsiteSegment,
  isFlowHistoryNode,
  isClonedNode,
  toggleNodeExpand,
  nodeHasAdapt,
  nodeHasRefine,
  stepTypeLabel,
  isCurrent,
  offsiteEntryLabel,
  offsiteInvokedLabel,
  reviewLabel,
  reviewAction,
  restartFromNode,
  formatIo,
  nodeBypassed,
  statusLabel,
  openAnnouncementMd,
  openDocsHub,
  rebuildAnnouncement,
  saveSessionNotes,
} from '../composables/useSessionDetail'
import { ref, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import AppLogo from '../../../components/AppLogo.vue'
import { api } from '../../../api'
import { createDocsMarkdown } from '../../docs/markdownRenderer'
import { openPath } from '../composables/useDocsHub'

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

const DOC_NAME_RE = /^(ANNOUNCEMENT\.md|README\.md|nodes\/step-\d{2}-[A-Za-z0-9_-]+\.md)$/

function resolveRailDocLink(href, sessionId) {
  const raw = String(href || '').trim()
  if (!raw || !sessionId) return null
  let sid = sessionId
  let rest = raw
  const abs = raw.match(/^\/journals\/sessions\/([^/]+)\/(.+)$/)
  if (abs) {
    sid = abs[1]
    rest = abs[2]
  } else {
    rest = raw.replace(/^\.\//, '')
  }
  if (sid !== sessionId) return null
  let name = rest.replace(/\\/g, '/')
  if (/^step-\d{2}-[A-Za-z0-9_-]+\.md$/.test(name)) name = `nodes/${name}`
  if (!DOC_NAME_RE.test(name)) return null
  return { sessionId: sid, name }
}

const md = computed(() =>
  createDocsMarkdown({
    workFolders: [sessionGroupFolder.value].filter(Boolean),
  }),
)
const railDocFiles = ref([])
const railDocsLoading = ref(false)
const selectedDocName = ref('')
const selectedDocContent = ref('')
const selectedDocLoading = ref(false)
const exportingRailDocs = ref(false)
let currentFileReqId = 0
let currentListReqId = 0

const renderedDocHtml = computed(() => {
  if (!selectedDocContent.value) return ''
  return md.value.render(selectedDocContent.value)
})

function onRailContentClick(e) {
  const pathEl = e.target.closest?.('.docs-path-link')
  if (pathEl) {
    e.preventDefault()
    openPath(pathEl.getAttribute('data-docs-path'))
    return
  }
  const docEl = e.target.closest?.('.docs-doc-link')
  if (docEl) {
    e.preventDefault()
    const r = resolveRailDocLink(docEl.getAttribute('data-docs-link'), activeId.value)
    if (r) onSelectRailDoc(r.name)
    else ElMessage.warning('无法定位文档')
  }
}

async function loadRailDocs() {
  const reqSessionId = activeId.value
  const reqId = ++currentListReqId
  if (!reqSessionId) {
    railDocFiles.value = []
    selectedDocName.value = ''
    selectedDocContent.value = ''
    return
  }
  railDocsLoading.value = true
  try {
    const res = await api.docs.list('group')
    if (reqId !== currentListReqId || reqSessionId !== activeId.value) return
    let found = null
    for (const g of res?.groups || []) {
      const s = (g.sessions || []).find((s) => s.sessionId === reqSessionId)
      if (s) {
        found = s
        break
      }
    }
    railDocFiles.value = found?.files || []
    if (railDocFiles.value.length && (!selectedDocName.value || !railDocFiles.value.some((f) => f.name === selectedDocName.value))) {
      await onSelectRailDoc(railDocFiles.value[0].name)
    } else if (!railDocFiles.value.length) {
      selectedDocName.value = ''
      selectedDocContent.value = ''
    }
  } catch (e) {
    if (reqId === currentListReqId && reqSessionId === activeId.value) {
      ElMessage.warning(e?.message || '加载文档列表失败')
    }
  } finally {
    if (reqId === currentListReqId) {
      railDocsLoading.value = false
    }
  }
}

async function onSelectRailDoc(name) {
  const reqSessionId = activeId.value
  const reqId = ++currentFileReqId
  if (!reqSessionId || !name) return
  selectedDocName.value = name
  selectedDocLoading.value = true
  try {
    const res = await api.docs.file(reqSessionId, name)
    if (reqId !== currentFileReqId || reqSessionId !== activeId.value) return
    selectedDocContent.value = res?.content || ''
  } catch (e) {
    if (reqId === currentFileReqId && reqSessionId === activeId.value) {
      ElMessage.error(e?.message || '读取文档内容失败')
    }
  } finally {
    if (reqId === currentFileReqId) {
      selectedDocLoading.value = false
    }
  }
}

async function onExportRailGroupDocs() {
  if (!detail.value?.session?.group_id) {
    ElMessage.warning('当前会话未绑定群模板')
    return
  }
  exportingRailDocs.value = true
  try {
    await api.docs.downloadDocsExport(detail.value.session.group_id)
    ElMessage.success('导出成功')
  } catch (e) {
    ElMessage.error(e?.message || '导出失败')
  } finally {
    exportingRailDocs.value = false
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

.wb-right-tabs {
  display: flex;
  gap: 4px;
  margin: 0 0 14px;
  padding: 3px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.05);
  box-shadow: inset 0 0.5px 1px rgba(0, 0, 0, 0.04);
}

.wb-right-tab {
  flex: 1;
  border: none;
  background: transparent;
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 550;
  color: var(--ecw-text-2, #6e6e73);
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}

.wb-right-tab:hover {
  color: var(--ecw-text-1, #1d1d1f);
}

.wb-right-tab.active {
  background: #fff;
  color: var(--ecw-text-1, #1d1d1f);
  font-weight: 650;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.wb-right-tab-badge {
  margin-left: 4px;
  min-width: 14px;
  padding: 0 4px;
  border-radius: 8px;
  font-size: 10px;
  line-height: 14px;
  background: rgba(230, 162, 60, 0.25);
  color: #9a6414;
}

.wb-right-pane {
  min-height: 0;
}

.flow-archive-hint {
  margin: 0 0 12px;
  font-size: 11.5px;
  color: var(--ecw-text-3, #8b8f9a);
}
.flow-step.is-flow-history {
  opacity: 0.72;
}
.flow-step.is-flow-anchor {
  scroll-margin-block: 12px;
}
.flow-offsite-hint {
  margin: 0 0 12px;
  font-size: 11.5px;
  color: #9a6414;
  line-height: 1.45;
}
.flow-offsite-action-tip {
  font-size: 11px;
  color: var(--ecw-text-3, #8b8f9a);
  line-height: 1.4;
}
.flow-archive-outcome.is-ok {
  color: var(--el-color-success);
  font-weight: 600;
}
.flow-archive-outcome.is-fail {
  color: var(--el-color-danger);
  font-weight: 600;
}
.flow-step-actions {
  padding: 0 4px 6px 28px;
}

.flow-params {
  margin: 0 0 14px;
  padding: 12px 12px 10px;
  border-radius: 12px;
  background: linear-gradient(160deg, #f5f9ff 0%, #fff 70%);
  border: 1px solid rgba(64, 158, 255, 0.16);
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.05);
}

.flow-params-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--ecw-accent, #409eff);
  margin-bottom: 8px;
}

.flow-param-card {
  margin-bottom: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(64, 158, 255, 0.12);
}

.flow-param-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.flow-param-card-label {
  font-size: 11px;
  color: var(--ecw-text-3, #8b8f9a);
}

.flow-param-card-body {
  margin: 0;
  font-size: 11px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--ecw-text-2, #5c5f6a);
  max-height: 120px;
  overflow: auto;
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
}

.flow-params-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 160px;
  overflow: auto;
}

.flow-param-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  font-size: 12px;
}

.flow-param-item--folder {
  margin-bottom: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(64, 158, 255, 0.1);
}

.flow-param-key {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(64, 158, 255, 0.1);
  color: var(--ecw-accent, #409eff);
}

.flow-param-val {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ecw-text-1, #0b0c0f);
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

.flow-current-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ecw-text-3, #8e8ea0);
  margin-bottom: 2px;
}

.flow-empty {
  padding: 28px 8px;
  text-align: center;
  color: var(--ecw-text-3, #8e8ea0);
  font-size: 12.5px;
}

.flow-empty p {
  margin: 0;
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

/* —— 第三栏：文档中心样式 —— */
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
}

.docs-rail-files {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 96px;
  overflow-y: auto;
  padding: 4px 2px;
  flex-shrink: 0;
}

.docs-rail-file-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 0.5px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.75);
  font-size: 11.5px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.docs-rail-file-pill:hover {
  background: rgba(255, 255, 255, 0.95);
  border-color: rgba(0, 122, 255, 0.3);
}

.docs-rail-file-pill.active {
  background: rgba(0, 122, 255, 0.1);
  border-color: rgba(0, 122, 255, 0.35);
  color: var(--ecw-accent, #007aff);
  font-weight: 600;
}

.pill-name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pill-badge {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.04);
}

.docs-rail-content-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.9);
  border: 0.5px solid rgba(0, 0, 0, 0.06);
}

.docs-rail-file-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  margin-bottom: 8px;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
}

.file-header-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--ecw-text-1, #1d1d1f);
}

.file-header-badge {
  font-size: 10.5px;
  color: var(--ecw-text-3, #86868b);
}

.docs-rail-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--ecw-text-1, #1d1d1f);
  word-break: break-word;
}

.docs-rail-content :deep(pre) {
  padding: 8px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.04);
  overflow: auto;
  font-size: 11px;
}

.docs-rail-empty {
  padding: 30px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--ecw-text-3, #86868b);
}

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
