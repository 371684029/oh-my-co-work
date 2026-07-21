<template>
  <div class="path-picker">
    <div class="path-picker-row">
      <el-input
        :model-value="modelValue"
        :placeholder="placeholder"
        clearable
        @update:model-value="onInput"
      />
      <el-button @click="open">浏览…</el-button>
    </div>
    <p v-if="hint" class="path-picker-hint">{{ hint }}</p>

    <el-dialog
      v-model="visible"
      :title="mode === 'folder' ? '选择文件夹' : '选择文件'"
      width="560px"
      append-to-body
      destroy-on-close
      class="path-picker-dialog"
      @opened="onOpened"
    >
      <div class="pp-toolbar">
        <el-button size="small" :disabled="!parentPath" @click="goParent">上级</el-button>
        <el-button size="small" @click="goRoots">根目录</el-button>
        <el-button size="small" :loading="loading" @click="refresh">刷新</el-button>
      </div>

      <div class="pp-crumbs" :title="currentPath">
        <span class="pp-crumbs-label">当前：</span>
        <code>{{ currentPath || '（选择根目录）' }}</code>
      </div>

      <div v-if="showRoots" class="pp-list">
        <button
          v-for="r in roots"
          :key="r.path"
          type="button"
          class="pp-item"
          @click="enter(r.path)"
          @dblclick="enter(r.path)"
        >
          <span class="pp-icon">{{ r.type === 'home' ? '⌂' : r.type === 'cwd' ? '◎' : '▣' }}</span>
          <span class="pp-name">{{ r.name }}</span>
          <span class="pp-meta">{{ r.path }}</span>
        </button>
      </div>

      <div v-else class="pp-list" v-loading="loading">
        <div v-if="!entries.length && !loading" class="pp-empty">空目录或无匹配项</div>
        <button
          v-for="e in entries"
          :key="e.path + e.name"
          type="button"
          class="pp-item"
          :class="{
            'is-dir': e.type === 'dir',
            'is-file': e.type === 'file',
            'is-selected': selected === e.path,
          }"
          @click="onClickEntry(e)"
          @dblclick="onDblEntry(e)"
        >
          <span class="pp-icon">{{ e.isParent ? '↑' : e.type === 'dir' ? '📁' : '📄' }}</span>
          <span class="pp-name">{{ e.name }}</span>
          <span v-if="e.type === 'file' && e.size != null" class="pp-meta">{{
            formatSize(e.size)
          }}</span>
        </button>
      </div>

      <template #footer>
        <div class="pp-footer">
          <span class="pp-selected" :title="selected || currentPath">
            {{ selected || (mode === 'folder' ? currentPath : '未选择文件') }}
          </span>
          <div class="pp-footer-actions">
            <el-button @click="visible = false">取消</el-button>
            <el-button type="primary" :disabled="!canConfirm" @click="confirm">
              选择此处
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '../api'

const props = defineProps({
  modelValue: { type: String, default: '' },
  /** folder | file */
  mode: { type: String, default: 'folder' },
  placeholder: { type: String, default: '' },
  hint: { type: String, default: '' },
  /** 文件扩展名过滤，如 ['.bat','.ps1','.py'] */
  extensions: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue'])

const visible = ref(false)
const loading = ref(false)
const showRoots = ref(false)
const roots = ref([])
const currentPath = ref('')
const parentPath = ref(null)
const entries = ref([])
const selected = ref('')

const canConfirm = computed(() => {
  if (props.mode === 'folder') return !!(selected.value || currentPath.value)
  return !!(selected.value && selected.value !== currentPath.value)
})

function onInput(v) {
  emit('update:modelValue', v ?? '')
}

function formatSize(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

async function open() {
  visible.value = true
}

async function onOpened() {
  selected.value = ''
  const start = (props.modelValue || '').trim()
  if (start) {
    try {
      const st = await api.fs.stat(start)
      if (st.ok) {
        if (st.isDirectory) {
          await enter(st.path)
          return
        }
        if (st.isFile) {
          selected.value = st.path
          await enter(parentOf(st.path) || st.path)
          return
        }
      }
    } catch {
      /* fallthrough */
    }
  }
  await loadRoots()
}

function parentOf(p) {
  if (!p) return ''
  const norm = p.replace(/[/\\]+$/, '')
  const i = Math.max(norm.lastIndexOf('\\'), norm.lastIndexOf('/'))
  if (i <= 0) return ''
  // Windows root like C:\
  if (/^[a-zA-Z]:$/.test(norm.slice(0, i))) return norm.slice(0, i + 1)
  return norm.slice(0, i) || norm
}

async function loadRoots() {
  loading.value = true
  showRoots.value = true
  currentPath.value = ''
  parentPath.value = null
  entries.value = []
  try {
    const r = await api.fs.roots()
    roots.value = r.roots || []
  } catch (e) {
    ElMessage.error(e.message || '无法读取根目录')
  } finally {
    loading.value = false
  }
}

async function enter(dir) {
  if (!dir) return
  loading.value = true
  showRoots.value = false
  try {
    const r = await api.fs.list(dir, {
      mode: props.mode === 'folder' ? 'folder' : 'all',
      extensions: props.extensions,
    })
    currentPath.value = r.path
    parentPath.value = r.parent
    entries.value = r.entries || []
    if (props.mode === 'folder') {
      selected.value = r.path
    }
  } catch (e) {
    ElMessage.error(e.message || '无法打开目录')
  } finally {
    loading.value = false
  }
}

function goParent() {
  if (parentPath.value) enter(parentPath.value)
  else loadRoots()
}

function goRoots() {
  loadRoots()
}

function refresh() {
  if (showRoots.value) loadRoots()
  else if (currentPath.value) enter(currentPath.value)
}

function onClickEntry(e) {
  if (e.type === 'dir') {
    if (props.mode === 'folder' && !e.isParent) {
      selected.value = e.path
    }
    // 单击目录：文件夹模式仅选中；双击进入。单击「..」进入
    if (e.isParent) enter(e.path)
  } else if (e.type === 'file' && props.mode === 'file') {
    selected.value = e.path
  }
}

function onDblEntry(e) {
  if (e.type === 'dir') {
    enter(e.path)
  } else if (e.type === 'file' && props.mode === 'file') {
    selected.value = e.path
    confirm()
  }
}

function confirm() {
  if (props.mode === 'folder') {
    const p = selected.value || currentPath.value
    if (!p) return
    emit('update:modelValue', p)
    visible.value = false
    return
  }
  if (!selected.value) {
    ElMessage.warning('请选择一个文件')
    return
  }
  emit('update:modelValue', selected.value)
  visible.value = false
}
</script>

<style scoped>
.path-picker-row {
  display: flex;
  gap: 8px;
  width: 100%;
}
.path-picker-row :deep(.el-input) {
  flex: 1;
  min-width: 0;
}
.path-picker-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.45;
}
.pp-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.pp-crumbs {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 10px;
  padding: 8px 10px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pp-crumbs code {
  font-size: 12px;
  color: var(--el-text-color-primary);
}
.pp-list {
  height: 320px;
  overflow: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 4px;
}
.pp-empty {
  padding: 28px;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.pp-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--el-text-color-primary);
}
.pp-item:hover {
  background: var(--el-fill-color-light);
}
.pp-item.is-selected {
  background: var(--el-color-primary-light-9);
  outline: 1px solid var(--el-color-primary-light-5);
}
.pp-icon {
  width: 1.4em;
  text-align: center;
  flex-shrink: 0;
}
.pp-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pp-meta {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pp-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}
.pp-selected {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}
.pp-footer-actions {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
}
</style>
