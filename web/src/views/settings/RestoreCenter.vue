<template>
  <div class="restore-center">
    <h2>还原中心</h2>
    <p class="restore-lead">
      炼化备份与流程步骤 git 快照的统一入口。步骤回退在工作台流程轨展开节点后操作。
    </p>

    <section v-if="data?.members?.length" class="restore-section">
      <h3>成员炼化备份</h3>
      <ul class="restore-list">
        <li v-for="m in refineMembers" :key="m.id">
          <strong>{{ m.name }}</strong>
          <span v-if="m.refineBackup" class="restore-path">{{ m.refineBackup }}</span>
          <span v-else class="restore-muted">无备份</span>
          <el-button
            v-if="m.refineBackup"
            size="small"
            type="warning"
            :loading="restoringId === m.id"
            @click="restoreRefine(m.id)"
          >
            还原到炼化前
          </el-button>
          <router-link :to="`/settings/members`" class="restore-link">成员设置</router-link>
        </li>
      </ul>
    </section>

    <section v-if="data?.sessions?.length" class="restore-section">
      <h3>近期会话 · 步骤改动</h3>
      <ul class="restore-list">
        <li v-for="s in data.sessions" :key="s.sessionId">
          <router-link :to="`/workbench/${s.sessionId}`">{{ s.title || s.sessionId }}</router-link>
          <ul>
            <li v-for="n in s.nodes" :key="n.id">
              步骤 {{ n.stepIndex + 1 }} · {{ n.title }} — {{ n.filesChanged }} 个文件
            </li>
          </ul>
        </li>
      </ul>
    </section>

    <p v-if="loading" class="restore-muted">加载中…</p>
    <p v-else-if="empty" class="restore-muted">暂无可还原项</p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../../api'

const data = ref(null)
const loading = ref(true)
const restoringId = ref('')

const refineMembers = computed(() =>
  (data.value?.members || []).filter((m) => m.refineEnabled || m.refineBackup),
)

const empty = computed(
  () =>
    !loading.value &&
    !refineMembers.value.length &&
    !(data.value?.sessions || []).length,
)

onMounted(async () => {
  try {
    data.value = await api.restoreCenter.list()
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
})

async function restoreRefine(id) {
  try {
    await ElMessageBox.confirm(
      '将把炼化改动的源文件还原到保存炼化前的备份。继续？',
      '还原炼化',
      { type: 'warning' },
    )
  } catch {
    return
  }
  restoringId.value = id
  try {
    await api.members.restoreRefine(id)
    ElMessage.success('已还原炼化源文件')
  } catch (e) {
    ElMessage.error(e.message || '还原失败')
  } finally {
    restoringId.value = ''
  }
}
</script>

<style scoped>
.restore-center h2 {
  margin: 0 0 8px;
}
.restore-lead {
  color: var(--ecw-text-2, #555);
  margin: 0 0 20px;
  max-width: 640px;
}
.restore-section {
  margin-bottom: 24px;
}
.restore-section h3 {
  font-size: 14px;
  margin: 0 0 10px;
}
.restore-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.restore-list > li {
  padding: 10px 0;
  border-bottom: 1px solid var(--ecw-border, #eee);
}
.restore-path {
  display: block;
  font-size: 12px;
  color: var(--ecw-text-3, #888);
  word-break: break-all;
}
.restore-muted {
  color: var(--ecw-text-3, #888);
  font-size: 13px;
}
.restore-link {
  margin-left: 8px;
  font-size: 13px;
}
</style>
