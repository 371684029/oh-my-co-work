<template>
  <div class="restore-center" role="region" aria-labelledby="restore-center-title">
    <h2 id="restore-center-title">{{ restoreT('title') }}</h2>
    <p class="restore-lead">
      {{ restoreT('lead') }}
    </p>

    <section v-if="refineMembers.length" class="restore-section">
      <h3>{{ restoreT('membersHeading') }}</h3>
      <ul class="restore-list">
        <li v-for="m in refineMembers" :key="m.id">
          <strong>{{ m.name }}</strong>
          <span v-if="m.refineBackup" class="restore-path">{{ m.refineBackup }}</span>
          <span v-else class="restore-muted">{{ restoreT('noBackup') }}</span>
          <el-button
            v-if="m.refineBackup"
            size="small"
            type="warning"
            :loading="restoringId === m.id"
            @click="restoreRefine(m.id)"
          >
            {{ restoreT('restoreRefine') }}
          </el-button>
          <router-link :to="`/settings/members`" class="restore-link">{{ restoreT('membersLink') }}</router-link>
        </li>
      </ul>
    </section>

    <section v-if="data?.sessions?.length" class="restore-section">
      <h3>{{ restoreT('sessionsHeading') }}</h3>
      <ul class="restore-list">
        <li v-for="s in data.sessions" :key="s.sessionId">
          <router-link :to="`/workbench/${s.sessionId}`">{{ s.title || s.sessionId }}</router-link>
          <ul>
            <li v-for="n in s.nodes" :key="n.id">
              {{ restoreNodeLine(n.stepIndex + 1, n.title, n.filesChanged) }}
            </li>
          </ul>
        </li>
      </ul>
    </section>

    <p v-if="loading" class="restore-muted">{{ restoreT('loading') }}</p>
    <p v-else-if="empty" class="restore-muted">{{ restoreT('empty') }}</p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import ElMessage from 'element-plus/es/components/message/index.mjs'
import ElMessageBox from 'element-plus/es/components/message-box/index.mjs'
import { api } from '../../api'
import {
  restoreT,
  restoreToast,
  restoreConfirm,
  restoreNodeLine,
} from '../../composables/settingsRestoreCopy.js'

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
    ElMessage.error(e.message || restoreToast('loadFail'))
  } finally {
    loading.value = false
  }
})

async function restoreRefine(id) {
  try {
    await ElMessageBox.confirm(
      restoreConfirm('body'),
      restoreConfirm('title'),
      { type: 'warning' },
    )
  } catch {
    return
  }
  restoringId.value = id
  try {
    await api.members.restoreRefine(id)
    ElMessage.success(restoreToast('restored'))
  } catch (e) {
    ElMessage.error(e.message || restoreToast('restoreFail'))
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
