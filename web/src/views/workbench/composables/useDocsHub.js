import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../../../api'
import { createDocsMarkdown } from '../../docs/markdownRenderer'

/**
 * 文档中心（4.0）模块级单例状态（furnaceUi.js 同款模式）。
 * 列表双排序 / 当前文档 / 公告编辑 / 链接解析，全部收敛在此；
 * DocsHub.vue 只做装配 + 模板。
 */

// ===== 路由上下文（由 initDocsHub 注入）=====
let _router = null
let _route = null
let _stopWatchers = []

// ===== 排序 =====
const SORT_KEY = 'acw.docsHubSort'
const sortOptions = [
  { label: '按群模板', value: 'group' },
  { label: '按时间', value: 'time' },
]

function readStoredSort() {
  try {
    return localStorage.getItem(SORT_KEY) === 'time' ? 'time' : 'group'
  } catch {
    return 'group'
  }
}

const sort = ref(readStoredSort())

// ===== 列表 =====
const listData = ref(null)
const listLoading = ref(false)
const listError = ref('')

// ===== 当前选择 =====
const current = ref(null) // { sessionId, name }
const file = ref(null) // api.docs.file 返回
const fileLoading = ref(false)

// ===== 公告编辑 =====
const editing = ref(false)
const draft = ref('')
const saving = ref(false)

// ===== workFolder 索引：仅群模板列表带 workFolder，单独兜底拉一次 =====
const workFolderBySession = ref({})
let workFoldersReady = false

const groups = computed(() =>
  listData.value?.sort === 'group' ? listData.value.groups || [] : [],
)
const items = computed(() =>
  listData.value?.sort === 'time' ? listData.value.items || [] : [],
)
const hasDocs = computed(() => groups.value.length > 0 || items.value.length > 0)

/** 当前选中文件所属会话（含标题 / 群名 / workFolder） */
const currentSession = computed(() => {
  if (!current.value) return null
  const id = current.value.sessionId
  for (const g of groups.value) {
    const s = (g.sessions || []).find((x) => x.sessionId === id)
    if (s) return s
  }
  const item = items.value.find((x) => x.sessionId === id)
  if (item) {
    return {
      sessionId: id,
      sessionTitle: item.sessionTitle,
      groupTitle: item.groupTitle,
      workFolder: workFolderBySession.value[id] || null,
    }
  }
  return {
    sessionId: id,
    sessionTitle: id,
    workFolder: workFolderBySession.value[id] || null,
  }
})

const canEdit = computed(() => file.value?.kind === 'announce')
const dirty = computed(
  () => editing.value && file.value != null && draft.value !== (file.value.content || ''),
)

/** 当前内容渲染 HTML（workFolder 变化时重建实例） */
const renderedHtml = computed(() => {
  if (!file.value || file.value.content == null) return ''
  const md = createDocsMarkdown({
    workFolders: [currentSession.value?.workFolder].filter(Boolean),
  })
  return md.render(file.value.content)
})

// ===== 工具函数 =====
function relativeTime(v) {
  if (v == null) return ''
  const t = typeof v === 'number' ? v : new Date(v).getTime()
  if (!Number.isFinite(t)) return ''
  const diffMs = Date.now() - t
  if (diffMs < 0) return ''
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return '刚刚'
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`
  return `${Math.floor(days / 7)} 周前`
}

function formatSize(n) {
  const b = Number(n) || 0
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function formatTime(v) {
  if (v == null) return ''
  const d = typeof v === 'number' ? new Date(v) : new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString()
}

function fileLabel(f) {
  if (f?.kind === 'step') {
    const m = /step-(\d{2})/.exec(f.name || '')
    return m ? `节点台账 · step-${m[1]}` : '节点台账'
  }
  return f?.title || f?.name || ''
}

function kindTag(kind) {
  if (kind === 'announce') return 'primary'
  if (kind === 'step') return 'success'
  return 'info'
}

function statusLabel(s) {
  const m = {
    active: '进行中',
    running: '执行中',
    waiting_human: '待确认',
    interrupted: '待恢复',
    archived: '已归档',
    failed: '失败',
    paused: '暂停',
  }
  return m[s] || s || '未知'
}

function statusClass(s) {
  if (s === 'archived') return 'archived'
  if (s === 'waiting_human' || s === 'failed') return 'waiting'
  if (s === 'interrupted' || s === 'paused') return 'interrupted'
  return 'active'
}

// ===== 加载 =====
async function ensureWorkFolders() {
  if (workFoldersReady) return
  try {
    const g = await api.docs.list('group')
    for (const group of g.groups || []) {
      for (const s of group.sessions || []) {
        if (s.workFolder) workFolderBySession.value[s.sessionId] = s.workFolder
      }
    }
    workFoldersReady = true
  } catch {
    /* workFolder 仅作路径识别增强，失败可忽略 */
  }
}

async function loadList() {
  listLoading.value = true
  listError.value = ''
  try {
    const data = await api.docs.list(sort.value)
    listData.value = data
    if (data.sort === 'group') {
      for (const group of data.groups || []) {
        for (const s of group.sessions || []) {
          if (s.workFolder) workFolderBySession.value[s.sessionId] = s.workFolder
        }
      }
      workFoldersReady = true
    }
  } catch (e) {
    listError.value = e?.message || '文档列表加载失败'
    listData.value = null
  } finally {
    listLoading.value = false
  }
}

async function loadFile(sessionId, name) {
  if (!sessionId || !name) return
  fileLoading.value = true
  try {
    file.value = await api.docs.file(sessionId, name)
    editing.value = false
    draft.value = file.value.content || ''
  } catch (e) {
    file.value = null
    ElMessage.error(e?.message || '读取文档失败')
  } finally {
    fileLoading.value = false
  }
}

// ===== 选择 =====
function syncQuery() {
  if (!_router) return
  const q = {}
  if (current.value?.sessionId) q.session = current.value.sessionId
  if (current.value?.name) q.file = current.value.name
  _router.replace({ path: '/docs', query: q }).catch(() => {})
}

/** 切换文件（含未保存守卫）；force 用于 URL 直达预选 */
async function selectFile(sessionId, name, { force = false } = {}) {
  if (!sessionId || !name) return
  if (!force && dirty.value) {
    try {
      await ElMessageBox.confirm('当前公告有未保存的修改，切换将丢失', '未保存', {
        type: 'warning',
        confirmButtonText: '放弃修改',
        cancelButtonText: '留在当前',
      })
    } catch {
      return
    }
  }
  editing.value = false
  current.value = { sessionId, name }
  syncQuery()
  await loadFile(sessionId, name)
}

// ===== 编辑 =====
function startEdit() {
  if (!canEdit.value || !file.value) return
  draft.value = file.value.content || ''
  editing.value = true
}

function cancelEdit() {
  editing.value = false
  draft.value = file.value?.content || ''
}

async function save() {
  if (!current.value || !canEdit.value) return
  saving.value = true
  try {
    await api.docs.saveAnnouncement(current.value.sessionId, draft.value)
    editing.value = false
    await loadList()
    await loadFile(current.value.sessionId, current.value.name)
    ElMessage.success('群报告已保存')
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

// ===== 链接解析（§3.4 文档互链）=====
const DOC_NAME_RE = /^(ANNOUNCEMENT\.md|README\.md|nodes\/step-\d{2}-[A-Za-z0-9_-]+\.md)$/

function resolveDocLink(href) {
  const raw = String(href || '').trim()
  if (!raw) return null
  let sessionId = current.value?.sessionId || null
  let rest = raw
  const abs = raw.match(/^\/journals\/sessions\/([^/]+)\/(.+)$/)
  if (abs) {
    sessionId = abs[1]
    rest = abs[2]
  } else {
    rest = raw.replace(/^\.\//, '')
  }
  if (!sessionId) return null
  const name = rest.replace(/\\/g, '/')
  if (!DOC_NAME_RE.test(name)) return null
  return { sessionId, name }
}

/** 本地路径链接：直接交服务端起文件管理器（confirm-free），仅错误提示 */
async function openPath(path) {
  try {
    const r = await api.docs.openPath(path)
    ElMessage.success(r.isDir ? '已在系统打开文件夹' : '已在系统打开所在文件夹')
  } catch (e) {
    ElMessage.warning(e?.message || '打开失败')
  }
}

// ===== 生命周期 =====
function onBeforeUnload(e) {
  if (!dirty.value) return
  e.preventDefault()
  e.returnValue = ''
}

function initDocsHub({ route, router }) {
  _route = route
  _router = router
  window.addEventListener('beforeunload', onBeforeUnload)
  _stopWatchers.push(
    watch(sort, (v) => {
      try {
        localStorage.setItem(SORT_KEY, v)
      } catch {
        /* 隐私模式忽略 */
      }
      loadList()
    }),
  )
}

function disposeDocsHub() {
  window.removeEventListener('beforeunload', onBeforeUnload)
  _stopWatchers.forEach((stop) => stop())
  _stopWatchers = []
  _router = null
  _route = null
  listData.value = null
  listError.value = ''
  current.value = null
  file.value = null
  editing.value = false
  draft.value = ''
  saving.value = false
  workFolderBySession.value = {}
  workFoldersReady = false
}

export {
  sort,
  sortOptions,
  listData,
  listLoading,
  listError,
  current,
  file,
  fileLoading,
  editing,
  draft,
  saving,
  groups,
  items,
  hasDocs,
  currentSession,
  canEdit,
  dirty,
  renderedHtml,
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
}
