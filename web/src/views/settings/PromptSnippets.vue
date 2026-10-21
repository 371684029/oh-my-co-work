<template>
  <div class="snippets-page">
    <div class="page-head">
      <div>
        <h2 class="page-title">提示词片段库</h2>
        <p class="page-desc">
          命名片段可在成员文案中用 <code>{{ snippetRef }}</code> 引用；成员配置里可勾选片段 ID 自动前置。
        </p>
      </div>
      <el-button type="primary" @click="addSnippet">新建片段</el-button>
    </div>

    <el-table v-loading="loading" :data="rows" stripe style="width: 100%">
      <el-table-column prop="name" label="名称" width="160" />
      <el-table-column prop="id" label="ID" width="200" show-overflow-tooltip />
      <el-table-column label="正文预览">
        <template #default="{ row }">
          <span class="body-preview">{{ preview(row.body) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" align="right">
        <template #default="{ row }">
          <el-button size="small" text type="primary" @click="editSnippet(row)">编辑</el-button>
          <el-button size="small" text type="danger" @click="removeSnippet(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../../api'

const loading = ref(false)
const rows = ref([])
const snippetRef = computed(() => '{{snippet:名称或ID}}')

function preview(body) {
  const s = String(body || '').replace(/\s+/g, ' ').trim()
  return s.length > 80 ? `${s.slice(0, 80)}…` : s || '（空）'
}

async function load() {
  loading.value = true
  try {
    const s = await api.appSettings.get()
    rows.value = Array.isArray(s.promptSnippets) ? [...s.promptSnippets] : []
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

async function saveAll(next) {
  loading.value = true
  try {
    await api.appSettings.update({ promptSnippets: next })
    rows.value = next
    ElMessage.success('已保存')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

function uid() {
  return `psn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

async function addSnippet() {
  const { value: name } = await ElMessageBox.prompt('片段名称', '新建片段', {
    inputPlaceholder: '例如：代码评审角色',
  })
  if (!name?.trim()) return
  const { value: body } = await ElMessageBox.prompt('片段正文', '新建片段', {
    inputType: 'textarea',
    inputPlaceholder: '写入 AGENTS / 启动提示词块…',
  })
  const next = [
    ...rows.value,
    {
      id: uid(),
      name: name.trim(),
      body: body || '',
      updatedAt: new Date().toISOString(),
    },
  ]
  await saveAll(next)
}

async function editSnippet(row) {
  const { value: body } = await ElMessageBox.prompt(`编辑「${row.name}」`, '片段正文', {
    inputType: 'textarea',
    inputValue: row.body || '',
  })
  if (body === undefined) return
  const next = rows.value.map((r) =>
    r.id === row.id ? { ...r, body, updatedAt: new Date().toISOString() } : r,
  )
  await saveAll(next)
}

async function removeSnippet(row) {
  await ElMessageBox.confirm(`删除片段「${row.name}」？`, '删除', { type: 'warning' })
  const next = rows.value.filter((r) => r.id !== row.id)
  await saveAll(next)
}

onMounted(load)
</script>

<style scoped>
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  gap: 16px;
}
.page-desc {
  color: var(--ecw-text-2, #666);
  font-size: 13px;
  margin-top: 6px;
}
.body-preview {
  font-size: 12px;
  color: var(--ecw-text-2, #666);
}
code {
  font-size: 12px;
  background: rgba(0, 0, 0, 0.06);
  padding: 1px 4px;
  border-radius: 4px;
}
</style>
