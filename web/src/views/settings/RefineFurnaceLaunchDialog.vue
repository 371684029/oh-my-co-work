<template>
  <el-dialog
    v-model="visible"
    :title="membersT('form.refineFurnaceLaunchTitle')"
    width="480px"
    destroy-on-close
  >
    <p class="rfl-hint">{{ membersT('form.refineFurnaceLaunchHint') }}</p>
    <el-radio-group v-model="target" class="rfl-targets">
      <el-radio value="grok">{{ membersT('form.refineFurnaceTargetGrok') }}</el-radio>
      <el-radio value="cursor">{{ membersT('form.refineFurnaceTargetCursor') }}</el-radio>
    </el-radio-group>
    <p class="rfl-hint">{{ membersT('form.refineFurnaceCursorNote') }}</p>
    <template #footer>
      <el-button @click="visible = false">{{ membersConfirmCancel() }}</el-button>
      <el-button type="primary" :loading="loading" :disabled="!memberId" @click="onPrimary">
        {{ membersT('form.refineFurnaceGo') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import ElMessage from 'element-plus/es/components/message/index.mjs'
import { api } from '../../api.js'
import { membersConfirmCancel, membersT } from '../../composables/settingsMembersCopy.js'
import {
  buildFurnaceLaunchQuery,
  readRefineFurnaceTarget,
  saveRefineFurnaceTarget,
  storeFurnaceBindIntent,
} from '../../composables/refineFurnaceLaunch.js'

const props = defineProps({
  memberId: { type: String, default: '' },
  draft: { type: Object, default: null },
})

const router = useRouter()
const visible = defineModel({ type: Boolean, default: false })
const target = ref('grok')
const loading = ref(false)

watch(
  () => visible.value,
  (open) => {
    if (!open) return
    const saved = readRefineFurnaceTarget()
    target.value = saved === 'cursor' ? 'cursor' : 'grok'
  },
)

async function onPrimary() {
  if (!props.memberId || loading.value) return
  const agent = target.value === 'cursor' ? 'cursor' : 'grok'
  saveRefineFurnaceTarget(agent)
  loading.value = true
  try {
    const focus = await api.furnace.setFocus({
      action: 'bind',
      memberId: props.memberId,
      draft: props.draft || undefined,
    })
    const seen = focus?.seenBy?.[agent]?.memberId || ''
    storeFurnaceBindIntent({
      memberId: focus?.memberId || props.memberId,
      seenMemberId: seen,
      displayName: focus?.displayName || '',
      agent,
    })
    visible.value = false
    router.push({
      path: '/workbench',
      query: buildFurnaceLaunchQuery({
        agent,
        memberId: focus?.memberId || props.memberId,
        jump: true,
      }),
    })
  } catch (e) {
    ElMessage.error(e?.message || membersT('form.refineFurnaceLoadFail'))
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.rfl-hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.rfl-targets {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 12px;
}
</style>
