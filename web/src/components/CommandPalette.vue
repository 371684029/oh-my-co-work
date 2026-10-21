<template>
  <el-dialog
    v-model="visible"
    :title="commandPaletteTitle()"
    width="520px"
    class="command-palette-dialog"
    append-to-body
    destroy-on-close
    :aria-label="t('a11y.commandPaletteDialog')"
    @closed="emit('closed')"
  >
    <el-input
      ref="inputRef"
      v-model="query"
      :placeholder="commandPalettePlaceholder()"
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
        :aria-selected="i === highlight"
        :class="{ active: i === highlight }"
        @click="run(item)"
        @mouseenter="highlight = i"
      >
        <span class="cp-kind">{{ item.kind }}</span>
        <span class="cp-label">{{ item.label }}</span>
      </li>
    </ul>
    <p v-if="!filtered.length" class="cp-empty" role="status">{{ commandPaletteEmpty() }}</p>
    <template #footer>
      <span class="cp-hint">{{ commandPaletteFooterHint() }}</span>
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
import { t } from '../i18n/index.js'
import {
  commandPaletteTitle,
  commandPalettePlaceholder,
  commandPaletteEmpty,
  commandPaletteFooterHint,
  commandPaletteKindNav,
  commandPaletteKindView,
  commandPaletteKindSession,
  commandPaletteNavWorkbench,
  commandPaletteNavDocs,
  commandPaletteNavSettings,
  commandPaletteNavRestore,
  commandPaletteZoomReset,
  commandPaletteZoomIn,
  commandPaletteZoomOut,
  commandPaletteThemeToggle,
} from '../composables/commandPaletteCopy.js'

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

const staticCommands = computed(() => [
  {
    id: 'nav-workbench',
    kind: commandPaletteKindNav(),
    label: commandPaletteNavWorkbench(),
    run: () => router.push('/workbench'),
  },
  {
    id: 'nav-docs',
    kind: commandPaletteKindNav(),
    label: commandPaletteNavDocs(),
    run: () => router.push('/docs'),
  },
  {
    id: 'nav-settings',
    kind: commandPaletteKindNav(),
    label: commandPaletteNavSettings(),
    run: () => router.push('/settings/prefs'),
  },
  {
    id: 'nav-restore',
    kind: commandPaletteKindNav(),
    label: commandPaletteNavRestore(),
    run: () => router.push('/settings/restore'),
  },
  {
    id: 'zoom-reset',
    kind: commandPaletteKindView(),
    label: commandPaletteZoomReset(),
    run: () => {
      const v = applyUiZoom(1)
      persistZoom(v)
    },
  },
  {
    id: 'zoom-in',
    kind: commandPaletteKindView(),
    label: commandPaletteZoomIn(),
    run: () => {
      const v = applyUiZoom(stepUiZoom(readStoredZoom(), 1))
      persistZoom(v)
    },
  },
  {
    id: 'zoom-out',
    kind: commandPaletteKindView(),
    label: commandPaletteZoomOut(),
    run: () => {
      const v = applyUiZoom(stepUiZoom(readStoredZoom(), -1))
      persistZoom(v)
    },
  },
  {
    id: 'theme-toggle',
    kind: commandPaletteKindView(),
    label: commandPaletteThemeToggle(),
    run: async () => {
      const s = await api.appSettings.get()
      const cur = normalizeColorScheme(s?.ui?.colorScheme || 'system')
      const next = cur === 'dark' ? 'light' : 'dark'
      applyColorScheme(next)
      await api.appSettings.update({ ui: { colorScheme: next } })
    },
  },
])

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
    kind: commandPaletteKindSession(),
    label: s.title || s.id,
    run: () => router.push(`/workbench/${s.id}`),
  }))
  const all = [...staticCommands.value, ...sessionItems]
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
