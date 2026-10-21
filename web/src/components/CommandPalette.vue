<template>
  <el-dialog
    v-model="visible"
    title="命令面板"
    width="520px"
    class="command-palette-dialog"
    append-to-body
    destroy-on-close
    @closed="emit('closed')"
  >
    <el-input
      ref="inputRef"
      v-model="query"
      placeholder="搜索会话、文档或输入命令…"
      :aria-label="t('a11y.commandPaletteSearch')"
      clearable
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter.prevent="runSelected"
    />
    <ul class="cp-list" role="listbox" :aria-label="t('a11y.commandPaletteList')">
      <li
        v-for="(item, i) in filtered"
        :key="item.id"
        role="option"
        :class="{ active: i === highlight }"
        @click="run(item)"
        @mouseenter="highlight = i"
      >
        <span class="cp-kind">{{ item.kind }}</span>
        <span class="cp-label">{{ item.label }}</span>
      </li>
    </ul>
    <p v-if="!filtered.length" class="cp-empty">无匹配项</p>
    <template #footer>
      <span class="cp-hint"><kbd>Ctrl/Cmd+K</kbd> 打开 · ↑↓ 选择 · Enter 执行</span>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import { useCommandPalette } from '../composables/useCommandPalette.js'
import {
  applyUiZoom,
  stepUiZoom,
  persistZoom,
  readStoredZoom,
} from '../composables/uiZoom.js'
import { applyColorScheme, normalizeColorScheme } from '../composables/uiColorScheme.js'
import { t } from '../i18n/zh-CN.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'closed'])

const router = useRouter()
const { hidePalette } = useCommandPalette()
const query = ref('')
const highlight = ref(0)
const inputRef = ref(null)
const sessions = ref([])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const staticCommands = [
  { id: 'nav-workbench', kind: '导航', label: '工作台', run: () => router.push('/workbench') },
  { id: 'nav-docs', kind: '导航', label: '文档中心', run: () => router.push('/docs') },
  { id: 'nav-settings', kind: '导航', label: '设置', run: () => router.push('/settings/prefs') },
  { id: 'nav-restore', kind: '导航', label: '还原中心', run: () => router.push('/settings/restore') },
  {
    id: 'zoom-reset',
    kind: '视图',
    label: '缩放重置 100%',
    run: () => {
      const v = applyUiZoom(1)
      persistZoom(v)
    },
  },
  {
    id: 'zoom-in',
    kind: '视图',
    label: '放大界面',
    run: () => {
      const v = applyUiZoom(stepUiZoom(readStoredZoom(), 1))
      persistZoom(v)
    },
  },
  {
    id: 'zoom-out',
    kind: '视图',
    label: '缩小界面',
    run: () => {
      const v = applyUiZoom(stepUiZoom(readStoredZoom(), -1))
      persistZoom(v)
    },
  },
  {
    id: 'theme-toggle',
    kind: '视图',
    label: '切换浅色/深色主题',
    run: async () => {
      const s = await api.appSettings.get()
      const cur = normalizeColorScheme(s?.ui?.colorScheme || 'system')
      const next = cur === 'dark' ? 'light' : 'dark'
      applyColorScheme(next)
      await api.appSettings.update({ ui: { colorScheme: next } })
    },
  },
]

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return
    query.value = ''
    highlight.value = 0
    try {
      sessions.value = await api.sessions.list()
    } catch {
      sessions.value = []
    }
    await nextTick()
    inputRef.value?.focus?.()
  },
)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const sessionItems = (sessions.value || []).map((s) => ({
    id: `session-${s.id}`,
    kind: '会话',
    label: s.title || s.id,
    run: () => router.push(`/workbench/${s.id}`),
  }))
  const all = [...staticCommands, ...sessionItems]
  if (!q) return all.slice(0, 14)
  return all.filter((x) => x.label.toLowerCase().includes(q)).slice(0, 14)
})

watch(filtered, () => {
  highlight.value = 0
})

function move(delta) {
  const n = filtered.value.length
  if (!n) return
  highlight.value = (highlight.value + delta + n) % n
}

function run(item) {
  visible.value = false
  hidePalette()
  item.run()
}

function runSelected() {
  const item = filtered.value[highlight.value]
  if (item) run(item)
}
</script>

<style scoped>
.cp-list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  max-height: 280px;
  overflow: auto;
}
.cp-list li {
  display: flex;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
}
.cp-list li.active,
.cp-list li:hover {
  background: var(--ecw-surface-2, rgba(0, 0, 0, 0.06));
}
.cp-kind {
  font-size: 11px;
  color: var(--ecw-text-3, #888);
  min-width: 48px;
}
.cp-label {
  flex: 1;
}
.cp-empty {
  margin: 12px 0 0;
  color: var(--ecw-text-3, #888);
  font-size: 13px;
}
.cp-hint {
  font-size: 12px;
  color: var(--ecw-text-3, #888);
}
.cp-hint kbd {
  font-family: inherit;
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--ecw-surface-2, #eee);
}
</style>
