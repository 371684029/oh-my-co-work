<template>
  <div class="docs-hub">
    <!-- 文档中心独立顶栏：返回工作台（同标签）+ 标题 + 刷新 -->
    <header class="dh-topbar">
      <div class="dh-topbar-left">
        <button type="button" class="dh-back" @click="goWorkbench">返回工作台</button>
        <h1 class="dh-title">文档中心</h1>
      </div>
      <div class="dh-topbar-right">
        <el-button size="small" :loading="listLoading" @click="refresh">刷新</el-button>
      </div>
    </header>

    <div class="dh-body">
      <!-- 左：文档菜单 -->
      <aside class="dh-left">
        <!-- 4.1.0 全文搜索 -->
        <div class="dh-search">
          <el-input
            v-model="searchQuery"
            placeholder="全文搜索…"
            clearable
            size="small"
          />
        </div>

        <div class="dh-sort">
          <el-segmented v-model="sort" :options="sortOptions" size="small" block />
        </div>

        <div class="dh-menu">
          <!-- 4.1.0 搜索结果 -->
          <template v-if="isSearching">
            <div v-if="searchLoading" class="dh-menu-empty">搜索中…</div>
            <div v-else-if="!searchResults.length" class="dh-menu-empty">无匹配结果</div>
            <template v-else>
              <button
                v-for="hit in searchResults"
                :key="`${hit.sessionId}:${hit.name}:${hit.line}`"
                type="button"
                class="dh-search-hit"
                @click="onSearchHit(hit)"
              >
                <div class="dh-hit-title">{{ hit.title || hit.name }}</div>
                <div class="dh-hit-meta">{{ hit.groupTitle }} · {{ hit.sessionTitle }}</div>
                <div class="dh-hit-snippet" v-html="highlightSnippet(hit.snippet, searchQuery)" />
                <div class="dh-hit-line">第 {{ hit.line }} 行</div>
              </button>
            </template>
          </template>

          <!-- 正常列表（非搜索） -->
          <template v-else>
            <div v-if="listLoading && !hasDocs" class="dh-menu-empty">加载中…</div>
            <div v-else-if="listError && !hasDocs" class="dh-menu-empty">{{ listError }}</div>

            <!-- 按群模板：群 → 会话 → 文件 -->
            <template v-else-if="sort === 'group'">
              <div v-for="g in groups" :key="groupKey(g)" class="dh-group">
                <button
                  type="button"
                  class="dh-group-head"
                  :aria-expanded="isGroupOpen(groupKey(g))"
                  @click="toggleGroup(groupKey(g))"
                >
                  <span class="dh-caret" :class="{ open: isGroupOpen(groupKey(g)) }" aria-hidden="true">›</span>
                  <span class="dh-group-title">{{ g.groupTitle }}</span>
                  <span class="dh-group-count">{{ sessionCount(g) }}</span>
                  <button
                    type="button"
                    class="dh-export-btn"
                    title="导出群文档 MD"
                    @click.stop="onExportGroup(groupKey(g))"
                  >导出</button>
                </button>

              <div v-show="isGroupOpen(groupKey(g))" class="dh-sessions">
                <div v-for="s in g.sessions" :key="s.sessionId" class="dh-session">
                  <button
                    type="button"
                    class="dh-session-head"
                    :aria-expanded="isSessionOpen(s.sessionId)"
                    @click="toggleSession(s.sessionId)"
                  >
                    <span class="dh-caret" :class="{ open: isSessionOpen(s.sessionId) }" aria-hidden="true">›</span>
                    <span
                      class="dh-status-dot"
                      :class="statusClass(s.status)"
                      :title="statusLabel(s.status)"
                      aria-hidden="true"
                    />
                    <span class="dh-session-title">{{ s.sessionTitle }}</span>
                    <span class="dh-session-time">{{ relativeTime(s.updatedAt) }}</span>
                  </button>

                  <div v-show="isSessionOpen(s.sessionId)" class="dh-files">
                    <button
                      v-for="f in s.files"
                      :key="f.name"
                      type="button"
                      class="dh-file"
                      :class="{ active: isActiveFile(s.sessionId, f.name) }"
                      @click="selectFile(s.sessionId, f.name)"
                    >
                      <span class="dh-file-name">{{ fileLabel(f) }}</span>
                      <el-tag size="small" round effect="plain" :type="kindTag(f.kind)">
                        {{ f.title }}
                      </el-tag>
                      <span v-if="f.meta?.adapt" class="dh-badge dh-badge--adapt">适配</span>
                      <span v-if="f.meta?.cloned" class="dh-badge dh-badge--cloned">克隆</span>
                      <span v-if="f.meta?.status" class="dh-badge" :class="`dh-badge--${f.meta.status}`">{{ statusLabel(f.meta.status) }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- 按时间：扁平列表 -->
          <template v-else>
            <button
              v-for="it in items"
              :key="`${it.sessionId}:${it.name}`"
              type="button"
              class="dh-time-item"
              :class="{ active: isActiveFile(it.sessionId, it.name) }"
              @click="selectFile(it.sessionId, it.name)"
            >
              <span class="dh-time-line">
                {{ it.groupTitle }} · {{ it.sessionTitle }} · {{ fileLabel(it) }}
              </span>
              <span class="dh-time-meta">{{ relativeTime(it.mtimeMs) }}</span>
            </button>
          </template>
          </template>

          <div v-if="!listLoading && !listError && !hasDocs" class="dh-menu-empty">
            暂无会话文档
          </div>
        </div>
      </aside>

      <!-- 右：内容区 -->
      <main class="dh-right">
        <!-- 未选中：居中友好提示 -->
        <div v-if="!current" class="dh-welcome">
          <div class="dh-welcome-hero">
            <h2 class="dh-welcome-title">{{ hasDocs ? '选择左侧文档' : '还没有会话文档' }}</h2>
            <p class="dh-welcome-desc">
              {{
                hasDocs
                  ? '从左侧菜单点选群报告、文档索引或节点台账'
                  : '会话跑完留下的群报告、文档索引与节点台账，会聚合在这里'
              }}
            </p>
          </div>
        </div>

        <!-- 读取中 -->
        <div v-else-if="fileLoading" class="dh-welcome">
          <p class="dh-welcome-desc">读取文档中…</p>
        </div>

        <!-- 文件 -->
        <template v-else-if="file">
          <div class="dh-content-head">
            <div class="dh-content-title-row">
              <h2 class="dh-file-title">{{ fileLabel(file) }}</h2>
              <el-tag size="small" round effect="plain" :type="kindTag(file.kind)">
                {{ file.title }}
              </el-tag>
            </div>
            <div class="dh-content-meta">
              <span v-if="currentSession?.sessionTitle">{{ currentSession.sessionTitle }}</span>
              <span>{{ formatSize(file.size) }}</span>
              <span>{{ formatTime(file.mtimeMs) }}</span>
            </div>
            <p v-if="file.truncated" class="dh-truncated-warn">文件超过 1MB，已截断显示</p>
          </div>

          <div class="dh-content-actions">
            <template v-if="canEdit">
              <el-button v-if="!editing" size="small" type="primary" @click="startEdit">
                编辑
              </el-button>
              <template v-else>
                <el-button size="small" type="primary" :loading="saving" @click="save">
                  保存
                </el-button>
                <el-button size="small" :disabled="saving" @click="cancelEdit">取消</el-button>
              </template>
            </template>
            <span v-else class="dh-readonly-hint">台账为只读（审计留痕）</span>
          </div>

          <!-- 渲染（只读） -->
          <div v-if="!editing" class="dh-content" @click="onContentClick" v-html="renderedHtml" />
          <!-- 编辑（仅公告） -->
          <el-input
            v-else
            v-model="draft"
            type="textarea"
            class="dh-editor"
            :autosize="{ minRows: 10, maxRows: 40 }"
            placeholder="在此编辑群报告 Markdown"
          />
        </template>
      </main>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { api } from '../../api'
import {
  sort,
  sortOptions,
  listLoading,
  listError,
  groups,
  items,
  hasDocs,
  current,
  file,
  fileLoading,
  editing,
  draft,
  saving,
  currentSession,
  canEdit,
  renderedHtml,
  // 4.1.0 搜索
  searchQuery,
  searchResults,
  searchLoading,
  isSearching,
  relativeTime,
  formatSize,
  formatTime,
  fileLabel,
  kindTag,
  statusLabel,
  statusClass,
  ensureWorkFolders,
  loadList,
  loadFile,
  selectFile,
  startEdit,
  cancelEdit,
  save,
  resolveDocLink,
  openPath,
  initDocsHub,
  disposeDocsHub,
} from '../workbench/composables/useDocsHub'

const route = useRoute()
const router = useRouter()

// 菜单展开态：群默认展开，会话默认收起（URL 直达时自动展开目标链）
const expandedGroups = ref({})
const expandedSessions = ref({})

function groupKey(g) {
  return g.groupId || 'none'
}

function sessionCount(g) {
  return (g.sessions || []).length
}

function isGroupOpen(key) {
  return expandedGroups.value[key] !== false
}

function isSessionOpen(id) {
  return !!expandedSessions.value[id]
}

function toggleGroup(key) {
  expandedGroups.value[key] = !isGroupOpen(key)
}

function toggleSession(id) {
  expandedSessions.value[id] = !isSessionOpen(id)
}

function expandFor(sessionId) {
  for (const g of groups.value) {
    if ((g.sessions || []).some((s) => s.sessionId === sessionId)) {
      expandedGroups.value[groupKey(g)] = true
      expandedSessions.value[sessionId] = true
      return
    }
  }
}

function isActiveFile(sessionId, name) {
  return current.value?.sessionId === sessionId && current.value?.name === name
}

function goWorkbench() {
  router.push('/workbench')
}

// 4.1.0 搜索结果点击
function onSearchHit(hit) {
  expandFor(hit.sessionId)
  selectFile(hit.sessionId, hit.name)
}

// 4.1.0 搜索高亮：对 snippet 中的 query 词加 <mark>
function highlightSnippet(snippet, query) {
  if (!snippet || !query) return snippet || ''
  const escaped = snippet.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const q = query.trim()
  if (!q) return escaped
  const words = q.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${words.join('|')})`, 'gi')
  return escaped.replace(re, '<mark>$1</mark>')
}

// 4.1.0 导出群文档
async function onExportGroup(groupId) {
  try {
    await api.docs.downloadDocsExport(groupId)
    ElMessage.success('导出成功')
  } catch (e) {
    ElMessage.error(e?.message || '导出失败')
  }
}

async function refresh() {
  await loadList()
  if (current.value) await loadFile(current.value.sessionId, current.value.name)
}

/** 内容区点击委托：本地路径 / 文档互链 / 外链三类行为 */
function onContentClick(e) {
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
      expandFor(r.sessionId)
      selectFile(r.sessionId, r.name)
    } else {
      ElMessage.warning('无法定位文档')
    }
    return
  }
  // 外链 target=_blank 交由浏览器默认行为
}

onMounted(async () => {
  initDocsHub({ route, router })
  await loadList()
  await ensureWorkFolders()
  const sid = route.query.session
  const fname = route.query.file
  if (sid && fname) {
    expandFor(String(sid))
    await selectFile(String(sid), String(fname), { force: true })
  }
})

onUnmounted(() => {
  disposeDocsHub()
})
</script>

<style scoped>
.docs-hub {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* —— 顶栏 —— */
.dh-topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border: 0.5px solid rgba(255, 255, 255, 0.55);
  border-radius: var(--ecw-radius-lg);
  background: var(--ecw-glass-strong);
  backdrop-filter: saturate(160%) blur(40px);
  -webkit-backdrop-filter: saturate(160%) blur(40px);
  box-shadow: var(--ecw-shadow-md);
}

.dh-topbar-left {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.dh-back {
  border: none;
  background: rgba(255, 255, 255, 0.5);
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--ecw-accent, #007aff);
  box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition:
    background 0.15s ease,
    transform 0.15s ease;
}

.dh-back:hover {
  background: rgba(255, 255, 255, 0.85);
}

.dh-back:active {
  transform: scale(0.97);
}

.dh-title {
  margin: 0;
  font-size: 16px;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--ecw-text-1, #1d1d1f);
}

.dh-topbar-right {
  flex-shrink: 0;
}

/* —— 主体 —— */
.dh-body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 12px;
}

/* —— 左栏 —— */
.dh-left {
  width: 320px;
  min-width: 320px;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  border: 0.5px solid rgba(255, 255, 255, 0.55);
  border-radius: var(--ecw-radius-xl);
  background: var(--ecw-glass-strong);
  backdrop-filter: saturate(160%) blur(40px);
  -webkit-backdrop-filter: saturate(160%) blur(40px);
  box-shadow: var(--ecw-shadow-md);
  overflow: hidden;
  padding: 12px 10px 16px;
}

.dh-sort {
  flex-shrink: 0;
  margin-bottom: 10px;
}

.dh-sort :deep(.el-segmented) {
  width: 100%;
  --el-border-radius-base: 9px;
  --el-segmented-item-padding: 0 8px;
  --el-segmented-bg-color: rgba(0, 0, 0, 0.05);
  --el-segmented-item-selected-bg-color: #fff;
  --el-segmented-item-selected-color: var(--ecw-text-1);
  background: rgba(0, 0, 0, 0.05);
  padding: 3px;
  font-size: 12px;
  border-radius: 10px;
  box-shadow: inset 0 0.5px 1px rgba(0, 0, 0, 0.04);
}

.dh-sort :deep(.el-segmented__item) {
  min-width: 0;
  flex: 1 1 0;
  overflow: visible;
  white-space: nowrap;
}

.dh-menu {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.dh-menu::-webkit-scrollbar {
  display: none;
}

.dh-menu-empty {
  padding: 28px 12px;
  text-align: center;
  font-size: 12.5px;
  color: var(--ecw-text-3, #86868b);
}

/* 群 */
.dh-group {
  margin-bottom: 4px;
}

.dh-group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 8px;
  border: none;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.dh-group-head:hover {
  background: var(--ecw-surface-hover, rgba(0, 0, 0, 0.04));
}

.dh-caret {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  font-size: 13px;
  color: var(--ecw-text-3, #86868b);
  transition: transform 0.15s ease;
}

.dh-caret.open {
  transform: rotate(90deg);
}

.dh-group-title {
  flex: 1;
  min-width: 0;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 650;
  color: var(--ecw-text-1, #1d1d1f);
}

.dh-group-count {
  flex-shrink: 0;
  min-width: 18px;
  padding: 0 6px;
  height: 16px;
  line-height: 16px;
  border-radius: 8px;
  font-size: 10.5px;
  text-align: center;
  color: var(--ecw-text-2, #6e6e73);
  background: rgba(0, 0, 0, 0.05);
}

/* 会话 */
.dh-session {
  margin-left: 14px;
}

.dh-session-head {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.dh-session-head:hover {
  background: var(--ecw-surface-hover, rgba(0, 0, 0, 0.04));
}

.dh-status-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d0d0d6;
}

.dh-status-dot.active {
  background: var(--ecw-accent, #007aff);
}

.dh-status-dot.waiting {
  background: var(--el-color-danger, #f56c6c);
}

.dh-status-dot.interrupted {
  background: #e6a23c;
}

.dh-status-dot.archived {
  background: #b0b4bc;
}

.dh-session-title {
  flex: 1;
  min-width: 0;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  color: var(--ecw-text-1, #1d1d1f);
}

.dh-session-time {
  flex-shrink: 0;
  font-size: 10.5px;
  color: var(--ecw-text-3, #86868b);
}

/* 文件 */
.dh-files {
  margin-left: 22px;
  padding-bottom: 2px;
}

.dh-file {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}

.dh-file:hover {
  background: var(--ecw-surface-hover, rgba(0, 0, 0, 0.04));
}

.dh-file.active {
  background: var(--ecw-accent-soft, rgba(0, 122, 255, 0.1));
  box-shadow: inset 0 0 0 0.5px rgba(0, 122, 255, 0.18);
}

.dh-file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  color: var(--ecw-text-1, #1d1d1f);
}

.dh-file.active .dh-file-name {
  color: var(--ecw-accent, #007aff);
  font-weight: 600;
}

/* 时间模式扁平项 */
.dh-time-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  margin-bottom: 2px;
  transition: background 0.15s ease;
}

.dh-time-item:hover {
  background: var(--ecw-surface-hover, rgba(0, 0, 0, 0.04));
}

.dh-time-item.active {
  background: var(--ecw-accent-soft, rgba(0, 122, 255, 0.1));
  box-shadow: inset 0 0 0 0.5px rgba(0, 122, 255, 0.18);
}

.dh-time-line {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  color: var(--ecw-text-1, #1d1d1f);
}

.dh-time-item.active .dh-time-line {
  color: var(--ecw-accent, #007aff);
  font-weight: 600;
}

.dh-time-meta {
  flex-shrink: 0;
  font-size: 10.5px;
  color: var(--ecw-text-3, #86868b);
}

/* —— 右栏 —— */
.dh-right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 0.5px solid rgba(255, 255, 255, 0.65);
  border-radius: var(--ecw-radius-xl);
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: saturate(160%) blur(36px);
  -webkit-backdrop-filter: saturate(160%) blur(36px);
  box-shadow: var(--ecw-shadow-lg);
  overflow: hidden;
  padding: 20px 24px 28px;
}

.dh-welcome {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 32px;
}

.dh-welcome-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 420px;
  animation: dh-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes dh-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.dh-welcome-title {
  margin: 0 0 10px;
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--ecw-text-1, #3a3a3c);
}

.dh-welcome-desc {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--ecw-text-2, #6a6a6e);
}

/* 内容头 */
.dh-content-head {
  flex-shrink: 0;
  padding-bottom: 14px;
  margin-bottom: 12px;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
}

.dh-content-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.dh-file-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--ecw-text-1, #1d1d1f);
  line-height: 1.35;
}

.dh-content-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--ecw-text-3, #86868b);
}

.dh-content-meta span + span::before {
  content: '·';
  margin-right: 12px;
  color: #c5c5c7;
}

.dh-truncated-warn {
  margin: 10px 0 0;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  color: #9a6414;
  background: rgba(230, 162, 60, 0.12);
}

/* 操作条 */
.dh-content-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.dh-readonly-hint {
  font-size: 12px;
  color: var(--ecw-text-3, #86868b);
}

/* 渲染正文 */
.dh-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.75;
  color: var(--ecw-text-1, #1d1d1f);
  word-break: break-word;
}

.dh-content :deep(h1),
.dh-content :deep(h2),
.dh-content :deep(h3),
.dh-content :deep(h4) {
  margin: 1.4em 0 0.6em;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--ecw-text-1, #1d1d1f);
  line-height: 1.3;
}

.dh-content :deep(h1) {
  font-size: 22px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.dh-content :deep(h2) {
  font-size: 18px;
}

.dh-content :deep(h3) {
  font-size: 15px;
}

.dh-content :deep(h4) {
  font-size: 14px;
}

.dh-content :deep(p) {
  margin: 0 0 12px;
}

.dh-content :deep(a) {
  color: var(--ecw-accent, #007aff);
  text-decoration: none;
}

.dh-content :deep(a:hover) {
  text-decoration: underline;
}

.dh-content :deep(a.docs-doc-link),
.dh-content :deep(a.docs-path-link) {
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 3px;
}

.dh-content :deep(ul),
.dh-content :deep(ol) {
  margin: 0 0 12px;
  padding-left: 1.6em;
}

.dh-content :deep(li) {
  margin: 4px 0;
}

.dh-content :deep(blockquote) {
  margin: 0 0 12px;
  padding: 4px 0 4px 14px;
  border-left: 3px solid rgba(0, 122, 255, 0.3);
  color: var(--ecw-text-2, #6e6e73);
}

.dh-content :deep(code) {
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 0.9em;
}

.dh-content :deep(p code),
.dh-content :deep(li code),
.dh-content :deep(td code) {
  padding: 1px 6px;
  border-radius: 5px;
  background: rgba(0, 0, 0, 0.05);
  color: #c0392b;
}

.dh-content :deep(pre) {
  margin: 0 0 12px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.04);
  border: 0.5px solid rgba(0, 0, 0, 0.05);
  overflow: auto;
  line-height: 1.55;
}

.dh-content :deep(pre code) {
  background: transparent;
  color: var(--ecw-text-1, #1d1d1f);
  padding: 0;
}

.dh-content :deep(table) {
  border-collapse: collapse;
  margin: 0 0 12px;
  width: 100%;
  font-size: 13px;
}

.dh-content :deep(th),
.dh-content :deep(td) {
  border: 0.5px solid rgba(0, 0, 0, 0.1);
  padding: 7px 10px;
  text-align: left;
}

.dh-content :deep(th) {
  background: rgba(0, 0, 0, 0.04);
  font-weight: 650;
}

.dh-content :deep(hr) {
  border: none;
  border-top: 0.5px solid rgba(0, 0, 0, 0.1);
  margin: 18px 0;
}

.dh-content :deep(img) {
  max-width: 100%;
  border-radius: 8px;
}

/* 编辑器 */
.dh-editor :deep(.el-textarea__inner) {
  border-radius: 12px;
  font-size: 13.5px;
  line-height: 1.7;
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace;
  min-height: 320px;
}

@media (prefers-reduced-motion: reduce) {
  .dh-welcome-hero {
    animation: none !important;
  }
}

/* —— 4.1.0 搜索 —— */
.dh-search {
  flex-shrink: 0;
  margin-bottom: 8px;
}

.dh-search-results {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.dh-search-results::-webkit-scrollbar {
  display: none;
}

.dh-search-hit {
  display: block;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}

.dh-search-hit:hover {
  background: var(--ecw-surface-hover, rgba(0, 0, 0, 0.04));
}

.dh-hit-title {
  font-size: 12.5px;
  font-weight: 650;
  color: var(--ecw-text-1, #1d1d1f);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dh-hit-meta {
  font-size: 11px;
  color: var(--ecw-text-3, #86868b);
  margin-top: 2px;
}

.dh-hit-snippet {
  font-size: 12px;
  line-height: 1.5;
  color: var(--ecw-text-2, #6e6e73);
  margin-top: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dh-hit-snippet :deep(mark) {
  background: rgba(255, 200, 0, 0.35);
  color: inherit;
  border-radius: 2px;
  padding: 0 1px;
}

.dh-hit-line {
  font-size: 10.5px;
  color: var(--ecw-text-3, #86868b);
  margin-top: 2px;
}

/* —— 4.1.0 导出按钮 —— */
.dh-export-btn {
  flex-shrink: 0;
  border: none;
  background: rgba(0, 122, 255, 0.08);
  color: var(--ecw-accent, #007aff);
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.dh-export-btn:hover {
  background: rgba(0, 122, 255, 0.16);
}

/* —— 4.1.0 节点徽标 —— */
.dh-badge {
  flex-shrink: 0;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 6px;
  line-height: 1.4;
  font-weight: 500;
}

.dh-badge--adapt {
  background: rgba(230, 162, 60, 0.15);
  color: #b87d1e;
}

.dh-badge--cloned {
  background: rgba(103, 194, 58, 0.15);
  color: #4a9c2d;
}

.dh-badge--active {
  background: rgba(0, 122, 255, 0.12);
  color: var(--ecw-accent, #007aff);
}

.dh-badge--running {
  background: rgba(0, 122, 255, 0.12);
  color: var(--ecw-accent, #007aff);
}

.dh-badge--waiting_human {
  background: rgba(245, 108, 108, 0.12);
  color: var(--el-color-danger);
}

.dh-badge--failed {
  background: rgba(245, 108, 108, 0.12);
  color: var(--el-color-danger);
}

.dh-badge--archived {
  background: rgba(176, 180, 188, 0.15);
  color: #6e6e73;
}

.dh-badge--interrupted,
.dh-badge--paused {
  background: rgba(230, 162, 60, 0.12);
  color: #b87d1e;
}
</style>
