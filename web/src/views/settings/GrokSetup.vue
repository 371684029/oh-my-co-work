<template>
  <div class="prefs-page">
    <div class="page-head">
      <div>
        <h2 class="page-title">Grok Build</h2>
        <p class="page-desc">未安装或未登录时按本页补齐。本机已装且已登录后，点顶栏熔炉会直接开 Grok TUI。秘钥只填在本机 config.toml。</p>
      </div>
      <el-button size="small" :loading="loading" @click="reload">重新检测</el-button>
    </div>
    <section class="prefs-card">
      <GrokSetupGuide :status="status" :example-toml="exampleToml" />
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import GrokSetupGuide from '../../components/GrokSetupGuide.vue'
import { api } from '../../api'
import { setFurnaceGrokGate } from '../../composables/furnaceUi.js'

const loading = ref(false)
const status = ref({})
const exampleToml = ref('')

async function reload() {
  loading.value = true
  try {
    const probe = await api.grok.status()
    status.value = probe
    exampleToml.value = probe.exampleToml || ''
    setFurnaceGrokGate({ probe })
  } catch (e) {
    ElMessage.error(e.message || '检测失败')
  } finally {
    loading.value = false
  }
}

onMounted(reload)
</script>
