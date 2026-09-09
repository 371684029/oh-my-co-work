<template>
  <div class="docs-hub">
    <!-- 主体：三栏工作流（群模板分类轨 -> 会话与文件轨 -> 文档正文区） -->
    <div class="dh-body">
      <!-- 栏 1：群模板/时间跨度分类导航 -->
      <aside class="dh-col dh-col-groups">
        <div class="dh-col-head">
          <span class="dh-col-title">{{ sort === 'group' ? '群模板' : '时间跨度' }}</span>
          <el-button
            size="small"
            type="primary"
            link
            :loading="exportingAll"
            @click="onExportAll"
          >
            导出全部
          </el-button>
        </div>

        <!-- 按群模式 -->
        <div v-if="sort === 'group'" class="dh-group-list">
          <!-- 全部选项 -->
          <button
            type="button"
            class="dh-group-item"
            :class="{ active: selectedGroupId === 'all' }"
            @click="selectedGroupId = 'all'"
          >
            <span class="dh-group-item-icon">📁</span>
            <span class="dh-group-item-name">全部群模板</span>
            <span class="dh-group-item-count">{{ totalSessionsCount }}</span>
          </button>

          <!-- 具体群 -->
          <div
            v-for="g in groups"
            :key="groupKey(g)"
            class="dh-group-item-wrap"
          >
            <button
              type="button"
              class="dh-group-item"
              :class="{ active: selectedGroupId === groupKey(g) }"
              @click="selectedGroupId = groupKey(g)"
            >
              <span class="dh-group-item-icon">👥</span>
              <span class="dh-group-item-name">{{ g.groupTitle }}</span>
              <span class="dh-group-item-count">{{ sessionCount(g) }}</span>
            </button>
            <button
              v-if="g.groupId"
              type="button"
              class="dh-group-export-btn"
              title="导出该群文档"
              @click.stop="onExportGroup(g.groupId)"
            >
              导出
            </button>
          </div>

          <div v-if="!listLoading && !groups.length" class="dh-empty-tip">
            暂无群模板
          </div>
        </div>

        <!-- 按时间模式：时间范围筛选 -->
        <div v-else class="dh-group-list">
          <button
            v-for="range in timeRanges"
            :key="range.key"
            type="button"
            class="dh-group-item"
            :class="{ active: selectedTimeRange === range.key }"
            @click="selectedTimeRange = range.key"
          >
            <span class="dh-group-item-icon">{{ range.icon }}</span>
            <span class="dh-group-item-name">{{ range.label }}</span>
            <span class="dh-group-item-count">{{ range.count }}</span>
          </button>
        </div>
      </aside>

      <!-- 栏 2：会话与文档列表（带搜索与排序） -->
      <aside class="dh-col dh-col-sessions">
        <div class="dh-search-box">
          <el-input
            v-model="searchQuery"
            placeholder="全文搜索…"
            clearable
            size="small"
          />
        </div>

        <div class="dh-toolbar-row">
          <el-segmented v-model="sort" :options="sortOptions" size="small" class="dh-segmented" />
          <el-button
            size="small"
            class="dh-refresh-btn"
            :loading="listLoading"
            @click="refresh"
          >
            刷新
          </el-button>
        </div>

        <div class="dh-sessions-menu">
          <!-- 全文搜索结果 -->
          <template v-if="isSearching">
            <div v-if="searchLoading" class="dh-empty-tip">搜索中…</div>
            <div v-else-if="!searchResults.length" class="dh-empty-tip">无匹配结果</div>
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

          <!-- 正常列表 -->
          <template v-else>
            <div v-if="listLoading && !hasDocs" class="dh-empty-tip">加载中…</div>
            <div v-else-if="listError && !hasDocs" class="dh-empty-tip">{{ listError }}</div>

            <!-- 按群分组展示 -->
            <template v-else-if="sort === 'group'">
              <div
                v-for="g in displayedGroups"
                :key="groupKey(g)"
                class="dh-group-block"
              >
                <div v-if="selectedGroupId === 'all'" class="dh-subgroup-title">
                  {{ g.groupTitle }}
                </div>
                <div
                  v-for="s in g.sessions"
                  :key="s.sessionId"
                  class="dh-session-block"
                >
                  <button
                    type="button"
                    class="dh-session-row"
                    :class="{ active: isSessionExpanded(s.sessionId) }"
                    @click="toggleSession(s.sessionId)"
                  >
                    <span
                      class="dh-caret"
                      :class="{ open: isSessionExpanded(s.sessionId) }"
                      aria-hidden="true"
                    >›</span>
                    <span
                      class="dh-status-dot"
                      :class="statusClass(s.status)"
                      :title="statusLabel(s.status)"
                      aria-hidden="true"
                    />
                    <span class="dh-session-title">{{ s.sessionTitle }}</span>
                    <span class="dh-session-time">{{ relativeTime(s.updatedAt) }}</span>
                  </button>

                  <div v-show="isSessionExpanded(s.sessionId)" class="dh-file-list">
                    <button
                      v-for="f in s.files"
                      :key="f.name"
                      type="button"
                      class="dh-file-row"
                      :class="{ active: isActiveFile(s.sessionId, f.name) }"
                      @click="selectFile(s.sessionId, f.name)"
                    >
                      <span class="dh-file-row-name">{{ fileLabel(f) }}</span>
                      <el-tag size="small" round effect="plain" :type="kindTag(f.kind)">
                        {{ f.title }}
                      </el-tag>
                      <span v-if="f.meta?.adapt" class="dh-badge dh-badge--adapt">适配</span>
                      <span v-if="f.meta?.cloned" class="dh-badge dh-badge--cloned">克隆</span>
                    </button>
                  </div>
                </div>
              </div>
            </template>

            <!-- 按时间扁平展示（支持按时间跨度筛选） -->
            <template v-else>
              <button
                v-for="it in displayedTimeItems"
                :key="`${it.sessionId}:${it.name}`"
                type="button"
                class="dh-time-row"
                :class="{ active: isActiveFile(it.sessionId, it.name) }"
                @click="selectFile(it.sessionId, it.name)"
              >
                <div class="dh-time-row-main">
                  <span class="dh-time-row-name">{{ fileLabel(it) }}</span>
                  <span class="dh-time-row-sub">{{ it.groupTitle }} · {{ it.sessionTitle }}</span>
                </div>
                <span class="dh-time-row-meta">{{ relativeTime(it.mtimeMs) }}</span>
              </button>
              <div v-if="!displayedTimeItems.length" class="dh-empty-tip">
                该时间段暂无文档
              </div>
            </template>
          </template>

          <div v-if="!listLoading && !listError && !hasDocs" class="dh-empty-tip">
            暂无会话文档
          </div>
        </div>
      </aside>

      <!-- 栏 3：文档中心核心正文区（文档中心在第三栏） -->
      <main class="dh-col dh-col-content">
        <!-- 未选中提示 -->
        <div v-if="!current" class="dh-welcome-pane">
          <div class="dh-welcome-hero">
            <h2 class="dh-welcome-title">{{ hasDocs ? '选择左侧文档查看' : '还没有会话文档' }}</h2>
            <p class="dh-welcome-desc">
              {{
                hasDocs
                  ? '从左侧列表中选择群报告、节点台账或会话索引'
                  : '工作流跑完产生的群报告与节点审计台账将自动汇总于此'
              }}
            </p>
          </div>
        </div>

        <!-- 读取中 -->
        <div v-else-if="fileLoading" class="dh-welcome-pane">
          <p class="dh-welcome-desc">正在加载文档内容…</p>
        </div>

        <!-- 文件详情与正文 -->
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
            :autosize="{ minRows: 12, maxRows: 42 }"
            placeholder="在此编辑群报告 Markdown"
          />
        </template>
      </main>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
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
  confirmDiscardIfDirty,
  resolveDocLink,
  openPath,
  initDocsHub,
  disposeDocsHub,
} from '../workbench/composables/useDocsHub'

const route = useRoute()
const router = useRouter()

const selectedGroupId = ref('all')
const selectedTimeRange = ref('all')
const expandedSessions = ref({})
const exportingAll = ref(false)

const timeRanges = computed(() => {
  const allCount = items.value.length
  const now = Date.now()
  const oneDay = 24 * 60 * 60 * 1000
  const sevenDays = 7 * oneDay
  const thirtyDays = 30 * oneDay

  let todayCount = 0
  let weekCount = 0
  let monthCount = 0
  let olderCount = 0

  for (const it of items.value) {
    const diff = now - Number(it.mtimeMs || 0)
    if (diff <= oneDay) todayCount++
    if (diff <= sevenDays) weekCount++
    if (diff <= thirtyDays) monthCount++
    if (diff > thirtyDays) olderCount++
  }

  return [
    { key: 'all', label: '全部时间', icon: '🕒', count: allCount },
    { key: 'today', label: '今天', icon: '⚡', count: todayCount },
    { key: 'week', label: '最近 7 天', icon: '📅', count: weekCount },
    { key: 'month', label: '最近 30 天', icon: '🗓️', count: monthCount },
    { key: 'older', label: '更早以前', icon: '📦', count: olderCount },
  ]
})

const displayedTimeItems = computed(() => {
  if (selectedTimeRange.value === 'all') return items.value
  const now = Date.now()
  const oneDay = 24 * 60 * 60 * 1000
  const sevenDays = 7 * oneDay
  const thirtyDays = 30 * oneDay

  return items.value.filter((it) => {
    const diff = now - Number(it.mtimeMs || 0)
    if (selectedTimeRange.value === 'today') return diff <= oneDay
    if (selectedTimeRange.value === 'week') return diff <= sevenDays
    if (selectedTimeRange.value === 'month') return diff <= thirtyDays
    if (selectedTimeRange.value === 'older') return diff > thirtyDays
    return true
  })
})

function groupKey(g) {
  return g.groupId || 'none'
}

function sessionCount(g) {
  return (g.sessions || []).length
}

const totalSessionsCount = computed(() => {
  return groups.value.reduce((acc, g) => acc + (g.sessions || []).length, 0)
})

const displayedGroups = computed(() => {
  if (selectedGroupId.value === 'all') return groups.value
  return groups.value.filter((g) => groupKey(g) === selectedGroupId.value)
})

function isSessionExpanded(id) {
  return expandedSessions.value[id] !== false
}

function toggleSession(id) {
  expandedSessions.value[id] = !isSessionExpanded(id)
}

function expandFor(sessionId) {
  for (const g of groups.value) {
    if ((g.sessions || []).some((s) => s.sessionId === sessionId)) {
      selectedGroupId.value = groupKey(g)
      expandedSessions.value[sessionId] = true
      return
    }
  }
}

function isActiveFile(sessionId, name) {
  return current.value?.sessionId === sessionId && current.value?.name === name
}

function onSearchHit(hit) {
  expandFor(hit.sessionId)
  selectFile(hit.sessionId, hit.name)
}

function highlightSnippet(snippet, query) {
  if (!snippet || !query) return snippet || ''
  const escaped = snippet.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const q = query.trim()
  if (!q) return escaped
  const words = q.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${words.join('|')})`, 'gi')
  return escaped.replace(re, '<mark>$1</mark>')
}

async function onExportGroup(groupId) {
  try {
    await api.docs.downloadDocsExport(groupId)
    ElMessage.success('群文档导出成功')
  } catch (e) {
    ElMessage.error(e?.message || '导出失败')
  }
}

async function onExportAll() {
  exportingAll.value = true
  try {
    await api.docs.downloadAllDocsExport()
    ElMessage.success('全量文档导出成功')
  } catch (e) {
    ElMessage.error(e?.message || '全量导出失败')
  } finally {
    exportingAll.value = false
  }
}

async function refresh() {
  if (!(await confirmDiscardIfDirty())) return
  await loadList()
  if (current.value) await loadFile(current.value.sessionId, current.value.name)
}

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
  }
}

onBeforeRouteLeave(async () => {
  return confirmDiscardIfDirty()
})

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
}

/* 主体：三栏容器 */
.dh-body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 12px;
}

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

/* —— 栏 1：群模板分类 —— */
.dh-col-groups {
  width: 220px;
  min-width: 200px;
  max-width: 240px;
  padding: 12px 10px;
}

.dh-col-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 6px 10px;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
  margin-bottom: 8px;
}

.dh-col-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--ecw-text-1, #1d1d1f);
}

.dh-group-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.dh-group-item-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dh-group-item {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: none;
  background: transparent;
  border-radius: 9px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}

.dh-group-item:hover {
  background: var(--ecw-surface-hover, rgba(0, 0, 0, 0.04));
}

.dh-group-item.active {
  background: var(--ecw-accent-soft, rgba(0, 122, 255, 0.1));
  box-shadow: inset 0 0 0 0.5px rgba(0, 122, 255, 0.18);
}

.dh-group-item-icon {
  font-size: 13px;
}

.dh-group-item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  color: var(--ecw-text-1, #1d1d1f);
}

.dh-group-item.active .dh-group-item-name {
  color: var(--ecw-accent, #007aff);
}

.dh-group-item-count {
  font-size: 11px;
  color: var(--ecw-text-3, #86868b);
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.04);
}

.dh-group-export-btn {
  flex-shrink: 0;
  border: none;
  background: rgba(0, 122, 255, 0.08);
  color: var(--ecw-accent, #007aff);
  padding: 3px 6px;
  border-radius: 6px;
  font-size: 10.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.dh-group-export-btn:hover {
  background: rgba(0, 122, 255, 0.16);
}

/* —— 栏 2：会话与文件 —— */
.dh-col-sessions {
  width: 290px;
  min-width: 270px;
  max-width: 320px;
  padding: 12px 10px 14px;
}

.dh-search-box {
  margin-bottom: 8px;
}

.dh-toolbar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.dh-segmented {
  flex: 1;
}

.dh-refresh-btn {
  flex-shrink: 0;
}

.dh-sessions-menu {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.dh-subgroup-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--ecw-text-3, #86868b);
  padding: 6px 8px 3px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.dh-session-block {
  margin-bottom: 4px;
}

.dh-session-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 8px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}

.dh-session-row:hover {
  background: var(--ecw-surface-hover, rgba(0, 0, 0, 0.04));
}

.dh-caret {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  font-size: 13px;
  color: var(--ecw-text-3, #86868b);
  transition: transform 0.15s ease;
}

.dh-caret.open {
  transform: rotate(90deg);
}

.dh-status-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #d0d0d6;
}

.dh-status-dot.active {
  background: var(--ecw-accent, #007aff);
}

.dh-session-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ecw-text-1, #1d1d1f);
}

.dh-session-time {
  font-size: 10.5px;
  color: var(--ecw-text-3, #86868b);
}

.dh-file-list {
  margin-left: 18px;
  padding: 2px 0 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dh-file-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}

.dh-file-row:hover {
  background: var(--ecw-surface-hover, rgba(0, 0, 0, 0.04));
}

.dh-file-row.active {
  background: var(--ecw-accent-soft, rgba(0, 122, 255, 0.1));
  box-shadow: inset 0 0 0 0.5px rgba(0, 122, 255, 0.18);
}

.dh-file-row-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--ecw-text-1, #1d1d1f);
}

.dh-file-row.active .dh-file-row-name {
  color: var(--ecw-accent, #007aff);
  font-weight: 600;
}

.dh-badge {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 4px;
  line-height: 1.2;
}

.dh-badge--adapt {
  background: rgba(230, 162, 60, 0.15);
  color: #b87d1e;
}

.dh-badge--cloned {
  background: rgba(103, 194, 58, 0.15);
  color: #4a9c2d;
}

/* 时间排序行 */
.dh-time-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  margin-bottom: 2px;
  transition: background 0.15s ease;
}

.dh-time-row:hover {
  background: var(--ecw-surface-hover, rgba(0, 0, 0, 0.04));
}

.dh-time-row.active {
  background: var(--ecw-accent-soft, rgba(0, 122, 255, 0.1));
}

.dh-time-row-main {
  flex: 1;
  min-width: 0;
}

.dh-time-row-name {
  display: block;
  font-size: 12.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dh-time-row-sub {
  display: block;
  font-size: 11px;
  color: var(--ecw-text-3, #86868b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dh-time-row-meta {
  font-size: 10.5px;
  color: var(--ecw-text-3, #86868b);
}

/* 搜索高亮 */
.dh-search-hit {
  width: 100%;
  padding: 8px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  margin-bottom: 4px;
}

.dh-search-hit:hover {
  background: var(--ecw-surface-hover, rgba(0, 0, 0, 0.04));
}

.dh-hit-title {
  font-size: 12px;
  font-weight: 650;
  color: var(--ecw-text-1, #1d1d1f);
}

.dh-hit-meta {
  font-size: 11px;
  color: var(--ecw-text-3, #86868b);
}

.dh-hit-snippet {
  font-size: 11.5px;
  line-height: 1.45;
  color: var(--ecw-text-2, #6e6e73);
  margin-top: 3px;
}

.dh-hit-snippet :deep(mark) {
  background: rgba(255, 200, 0, 0.35);
  border-radius: 2px;
}

.dh-hit-line {
  font-size: 10px;
  color: var(--ecw-text-3, #86868b);
  margin-top: 2px;
}

/* —— 栏 3：正文内容区（文档中心在第三栏） —— */
.dh-col-content {
  flex: 1;
  min-width: 0;
  padding: 20px 24px 28px;
  background: rgba(255, 255, 255, 0.88);
}

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

.dh-content-head {
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
}

.dh-content-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dh-file-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--ecw-text-1, #1d1d1f);
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
  font-size: 14px;
  line-height: 1.7;
  color: var(--ecw-text-1, #1d1d1f);
  word-break: break-word;
}

.dh-content :deep(h1),
.dh-content :deep(h2),
.dh-content :deep(h3) {
  margin: 1.2em 0 0.5em;
  font-weight: 650;
  color: var(--ecw-text-1, #1d1d1f);
}

.dh-content :deep(p) {
  margin: 0 0 10px;
}

.dh-content :deep(code) {
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 0.9em;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.05);
}

.dh-content :deep(pre) {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.04);
  overflow: auto;
}

.dh-content :deep(pre code) {
  background: transparent;
  padding: 0;
}

.dh-editor :deep(.el-textarea__inner) {
  border-radius: 10px;
  font-size: 13.5px;
  line-height: 1.6;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
}

.dh-empty-tip {
  padding: 24px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--ecw-text-3, #86868b);
}
</style>
