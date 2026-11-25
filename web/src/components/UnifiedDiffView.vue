<template>
  <div class="unified-diff" :class="themeClass" role="region" :aria-label="ariaLabel">
    <div
      v-for="(row, i) in rows"
      :key="i"
      class="unified-diff-row"
      :class="rowClass(row)"
    >
      <span class="gutter gutter-old" aria-hidden="true">{{ gutterOld(row) }}</span>
      <span class="gutter gutter-new" aria-hidden="true">{{ gutterNew(row) }}</span>
      <span class="sign" aria-hidden="true">{{ sign(row) }}</span>
      <code class="code">{{ row.text }}</code>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { parseUnifiedDiff } from '../composables/unifiedDiffLines.js'

const props = defineProps({
  diff: { type: String, default: '' },
  /** dark：文档中心炼化区；light：流程轨浅底 */
  theme: { type: String, default: 'dark' },
  ariaLabel: { type: String, default: '代码差异对比' },
})

const rows = computed(() => parseUnifiedDiff(props.diff))
const themeClass = computed(() => (props.theme === 'light' ? 'is-light' : 'is-dark'))

function gutterOld(row) {
  if (row.kind === 'add') return ''
  return row.oldNo != null ? row.oldNo : ''
}

function gutterNew(row) {
  if (row.kind === 'del') return ''
  return row.newNo != null ? row.newNo : ''
}

function sign(row) {
  if (row.kind === 'add') return '+'
  if (row.kind === 'del') return '−'
  if (row.kind === 'hunk') return '@@'
  return ' '
}

function rowClass(row) {
  return {
    'is-meta': row.kind === 'meta',
    'is-hunk': row.kind === 'hunk',
    'is-ctx': row.kind === 'ctx',
    'is-add': row.kind === 'add',
    'is-del': row.kind === 'del',
  }
}
</script>

<style scoped>
.unified-diff {
  margin: 6px 0 0;
  max-height: 280px;
  overflow: auto;
  border-radius: 8px;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 11.5px;
  line-height: 1.5;
}

.unified-diff-row {
  display: grid;
  grid-template-columns: 2.5em 2.5em 1.25em minmax(0, 1fr);
  gap: 0 6px;
  padding: 0 8px 0 4px;
  min-height: 1.5em;
  align-items: start;
}

.gutter {
  text-align: right;
  color: var(--ud-gutter, #6e7681);
  user-select: none;
  padding-top: 1px;
}

.sign {
  user-select: none;
  text-align: center;
  opacity: 0.85;
}

.code {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
}

/* Cursor / VS Code–style on dark panel */
.unified-diff.is-dark {
  background: #1e1e1e;
  border: 1px solid rgba(255, 255, 255, 0.08);
  --ud-gutter: #6e7681;
  color: #d4d4d4;
}

.is-dark .is-hunk,
.is-dark .is-meta {
  background: rgba(56, 139, 253, 0.12);
  color: #79b8ff;
}

.is-dark .is-del {
  background: rgba(248, 81, 73, 0.22);
  color: #ffa198;
}

.is-dark .is-del .sign {
  color: #ff7b72;
}

.is-dark .is-add {
  background: rgba(63, 185, 80, 0.2);
  color: #7ee787;
}

.is-dark .is-add .sign {
  color: #3fb950;
}

.is-dark .is-ctx .code {
  color: #c9d1d9;
}

/* Light theme (flow rail) */
.unified-diff.is-light {
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0, 0, 0, 0.06);
  --ud-gutter: #8b8f9a;
  color: #24292f;
}

.is-light .is-hunk,
.is-light .is-meta {
  background: rgba(9, 105, 218, 0.08);
  color: #0550ae;
}

.is-light .is-del {
  background: #ffebe9;
  color: #82071e;
}

.is-light .is-del .sign {
  color: #cf222e;
}

.is-light .is-add {
  background: #dafbe1;
  color: #116329;
}

.is-light .is-add .sign {
  color: #1a7f37;
}
</style>