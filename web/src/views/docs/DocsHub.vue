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
                      <span class="dh-kind-chip">{{ f.title }}</span>
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
      <main class="dh-col dh-col-content" :class="readingClasses" :style="readingStyle">
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
              <span class="dh-kind-chip">{{ file.title }}</span>
            </div>
            <div class="dh-content-meta">
              <span v-if="currentSession?.sessionTitle">{{ currentSession.sessionTitle }}</span>
              <span>{{ formatSize(file.size) }}</span>
              <span>{{ formatTime(file.mtimeMs) }}</span>
            </div>
            <p v-if="file.truncated" class="dh-truncated-warn">文件超过 1MB，已截断显示</p>
          </div>

          <div v-if="inDocSearch && inDocMarkTotal && !editing" class="dh-in-doc-search">
            <span class="dh-in-doc-search-label">正文「{{ inDocSearch.query }}」· {{ inDocSearchLabel }}</span>
            <el-button size="small" @click="stepInDocSearchMark(-1)">上一个</el-button>
            <el-button size="small" @click="stepInDocSearchMark(1)">下一个</el-button>
            <el-button size="small" link type="info" @click="clearInDocSearch">关闭</el-button>
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
              {{ readingPrefs.theme === 'dark' ? '浅色' : '深色' }}
            </el-button>
            <el-button
              size="small"
              :type="readingPrefs.focus ? 'primary' : 'default'"
              plain
              @click="toggleReadingFocus"
            >
              {{ readingPrefs.focus ? '退出专注' : '专注' }}
            </el-button>
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
            <el-button
              v-if="!editing && file"
              size="small"
              :type="codeLineNumbers ? 'primary' : 'default'"
              plain
              @click="toggleCodeLineNumbers"
            >
              代码行号
            </el-button>
          </div>

          <!-- 渲染（只读） -->
          <div
            v-if="!editing"
            ref="contentScrollRef"
            class="dh-content doc-prose"
            @click="onContentClick"
            v-html="renderedHtml"
          />

          <nav
            v-if="docOutline.length && !editing"
            class="dh-outline"
            aria-label="文档目录"
          >
            <div class="dh-outline-title">目录</div>
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
import { onMounted, onUnmounted, ref, computed, watch, nextTick } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { api } from '../../api'
import './docProse.css'
import { handleDocsProseClick } from './docsCodeFence.js'
import {
  applyInDocSearchMarks,
  clearInDocSearchMarks,
  scrollToInDocSearchMark,
} from './docsInDocSearch.js'
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
  searchQuery,
  searchResults,
  searchLoading,
  isSearching,
  inDocSearch,
  inDocMarkTotal,
  inDocSearchLabel,
  activateInDocSearch,
  clearInDocSearch,
  setInDocMarkTotal,
  stepInDocSearchMark,
  relativeTime,
  formatSize,
  formatTime,
  fileLabel,
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
  activateInDocSearch(searchQuery.value, hit.line || 1)
  expandFor(hit.sessionId)
  selectFile(hit.sessionId, hit.name)
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
  await loadList({ force: true })
  if (current.value) await loadFile(current.value.sessionId, current.value.name)
}

const contentScrollRef = ref(null)
const activeOutlineSlug = ref('')
let outlineObserver = null

function scrollToHeading(slug) {
  const root = contentScrollRef.value
  if (!root || !slug) return
  const el = root.querySelector(`#${CSS.escape(slug)}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    activeOutlineSlug.value = slug
  }
}

async function copyHeadingAnchor(slug) {
  if (!slug) return
  const hash = `#${slug}`
  try {
    await navigator.clipboard.writeText(hash)
    ElMessage.success('已复制锚点链接')
  } catch {
    ElMessage.success(`锚点 ${hash}`)
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
  const headings = [...root.querySelectorAll('h1[id], h2[id], h3[id]')]
  if (!headings.length) return
  outlineObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)
      if (visible[0]?.target?.id) activeOutlineSlug.value = visible[0].target.id
    },
    { root, rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.25, 0.5, 1] },
  )
  for (const h of headings) outlineObserver.observe(h)
  if (!activeOutlineSlug.value && headings[0]?.id) activeOutlineSlug.value = headings[0].id
}

watch([file, editing, renderedHtml], () => {
  if (editing.value || !file.value) {
    teardownOutlineObserver()
    return
  }
  nextTick(() => setupOutlineObserver())
})

async function onContentClick(e) {
  const handled = await handleDocsProseClick(e, {
    onCopied: () => ElMessage.success('已复制代码'),
    onCopyFailed: () => ElMessage.warning('复制失败'),
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
  teardownOutlineObserver()
  clearInDocSearchMarks(contentScrollRef.value)
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
