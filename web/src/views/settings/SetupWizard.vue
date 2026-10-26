<template>
  <div class="wizard-page">
    <div class="page-head">
      <div>
        <h2 class="page-title">首次启动向导</h2>
        <p class="page-desc">检测 CLI、工作目录与示例模板（DSK-07）</p>
      </div>
    </div>

    <el-steps :active="step" finish-status="success" align-center class="wizard-steps">
      <el-step title="环境" />
      <el-step title="Grok / Cursor" />
      <el-step title="示例模板" />
    </el-steps>

    <section v-if="step === 0" class="wizard-card">
      <p>运行环境：<strong>{{ isDesktop ? `桌面 (${desktopEnv})` : '浏览器' }}</strong></p>
      <el-form label-width="120px">
        <el-form-item label="默认工作目录">
          <el-input v-model="workDir" placeholder="可选，成员/群模板可单独设置" />
        </el-form-item>
      </el-form>
      <el-button type="primary" @click="step = 1">下一步</el-button>
    </section>

    <section v-else-if="step === 1" class="wizard-card">
      <p v-if="probeLoading">正在探测 CLI…</p>
      <template v-else>
        <p>Grok：{{ probe.installed ? '已安装' : '未检测到' }} · Cursor：{{ probe.cursor?.installed ? '已安装' : '未检测到' }}</p>
        <el-button text type="primary" @click="router.push('/settings/grok')">打开 Grok 教程</el-button>
      </template>
      <div class="wizard-actions">
        <el-button @click="step = 0">上一步</el-button>
        <el-button type="primary" @click="step = 2">下一步</el-button>
      </div>
    </section>

    <section v-else class="wizard-card">
      <p>可一键导入内置示例群模板（代码评审 / 需求拆解等）。</p>
      <el-select v-model="templateId" placeholder="选择模板" style="width: 100%; max-width: 360px">
        <el-option v-for="t in templates" :key="t.id" :label="t.title" :value="t.id" />
      </el-select>
      <div class="wizard-actions">
        <el-button @click="step = 1">上一步</el-button>
        <el-button type="primary" :loading="finishing" @click="finish">完成</el-button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ElMessage from 'element-plus/es/components/message/index.mjs'
import { api } from '../../api'
import { useDesktopBridge } from '../../composables/useDesktopBridge.js'

const router = useRouter()
const { isDesktop, desktopEnv, initDesktopBridge } = useDesktopBridge()
initDesktopBridge()

const step = ref(0)
const workDir = ref('')
const probe = ref({})
const probeLoading = ref(true)
const templates = ref([])
const templateId = ref('')
const finishing = ref(false)

onMounted(async () => {
  try {
    const [p, tpl] = await Promise.all([api.grok.status(), api.templates.listBuiltin()])
    probe.value = p
    templates.value = tpl.templates || []
    if (templates.value[0]) templateId.value = templates.value[0].id
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    probeLoading.value = false
  }
})

async function finish() {
  finishing.value = true
  try {
    if (templateId.value) {
      await api.templates.applyBuiltin(templateId.value, {})
      ElMessage.success('已创建示例群模板')
    }
    await api.appSettings.update({
      onboarding: { firstRunGuideDismissed: true, setupWizardCompleted: true },
    })
    router.push('/settings/groups')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    finishing.value = false
  }
}
</script>

<style scoped>
.wizard-page {
  max-width: 640px;
}
.wizard-steps {
  margin: 24px 0;
}
.wizard-card {
  padding: 16px 0;
}
.wizard-actions {
  margin-top: 20px;
  display: flex;
  gap: 12px;
}
</style>
