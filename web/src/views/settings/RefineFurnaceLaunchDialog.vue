<template>
  <el-dialog
    v-model="visible"
    :title="membersT('form.refineFurnaceLaunchTitle')"
    width="520px"
    destroy-on-close
    @closed="onClosed"
  >
    <p class="rfl-hint">{{ membersT('form.refineFurnaceLaunchHint') }}</p>
    <el-radio-group v-model="target" class="rfl-targets">
      <el-radio value="grok">{{ membersT('form.refineFurnaceTargetGrok') }}</el-radio>
      <el-radio value="cursor">{{ membersT('form.refineFurnaceTargetCursor') }}</el-radio>
      <el-radio value="external">{{ membersT('form.refineFurnaceTargetExternal') }}</el-radio>
    </el-radio-group>
    <el-radio-group v-model="mode" class="rfl-modes">
      <el-radio value="jump">{{ membersT('form.refineFurnaceModeJump') }}</el-radio>
      <el-radio value="copy">{{ membersT('form.refineFurnaceModeCopy') }}</el-radio>
    </el-radio-group>
    <div v-if="loading" class="rfl-loading">{{ membersT('form.refineFurnaceLoading') }}</div>
    <el-input
      v-else-if="mode === 'copy' && promptText"
      v-model="promptText"
      type="textarea"
      :rows="14"
      readonly
      class="rfl-prompt"
    />
    <template #footer>
      <el-button @click="visible = false">{{ membersConfirmCancel() }}</el-button>
      <el-button type="primary" :loading="loading" :disabled="!memberId" @click="onPrimary">
        {{ mode === 'jump' ? membersT('form.refineFurnaceGo') : membersT('form.refineCopyFurnaceSkill') }}
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
  storeFurnaceRefinePrefill,
} from '../../composables/refineFurnaceLaunch.js'
import { writeClipboardText } from '../../composables/terminalClipboardBridge.js'

const props = defineProps({
  memberId: { type: String, default: '' },
})

const router = useRouter()
const visible = defineModel({ type: Boolean, default: false })
const target = ref('grok')
const mode = ref('jump')
const loading = ref(false)
const promptText = ref('')

async function loadPrompt() {
  if (!props.memberId) return
  loading.value = true
  try {
    const r = await api.members.refineVerifyPrompt(props.memberId, { target: target.value })
    promptText.value = r?.prompt || ''
  } catch (e) {
    promptText.value = ''
    ElMessage.error(e?.message || membersT('form.refineFurnaceLoadFail'))
  } finally {
    loading.value = false
  }
}

watch(
  () => [visible.value, props.memberId, target.value],
  ([open]) => {
    if (open && props.memberId) {
      target.value = readRefineFurnaceTarget()
      saveRefineFurnaceTarget(target.value)
      loadPrompt()
    }
  },
)

function onClosed() {
  promptText.value = ''
  mode.value = 'jump'
}

async function copyPrompt() {
  const text = promptText.value
  if (!text) await loadPrompt()
  if (!promptText.value) return false
  try {
    await writeClipboardText(promptText.value)
    ElMessage.success(membersT('form.refineFurnaceCopied'))
    return true
  } catch {
    ElMessage.info(promptText.value)
    return true
  }
}

async function onPrimary() {
  if (!promptText.value && !loading.value) await loadPrompt()
  if (!promptText.value) return
  saveRefineFurnaceTarget(target.value)
  if (mode.value === 'copy') {
    await copyPrompt()
    return
  }
  const agent = target.value === 'external' ? 'grok' : target.value
  storeFurnaceRefinePrefill(promptText.value, agent)
  await copyPrompt()
  visible.value = false
  router.push({
    path: '/workbench',
    query: buildFurnaceLaunchQuery({ agent, memberId: props.memberId, jump: true }),
  })
}
</script>

<style scoped>
.rfl-hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.rfl-targets,
.rfl-modes {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 12px;
}
.rfl-loading {
  padding: 12px 0;
  color: var(--el-text-color-secondary);
}
.rfl-prompt {
  font-family: ui-monospace, monospace;
  font-size: 12px;
}
</style>