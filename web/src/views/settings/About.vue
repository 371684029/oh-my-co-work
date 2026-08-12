<template>
  <div class="about-page">
    <div class="page-head">
      <div>
        <h2 class="page-title">关于与更新</h2>
        <p class="page-desc">版本信息 · 更新日志 · 本地承诺</p>
      </div>
    </div>

    <div v-if="loading" class="about-loading">加载中…</div>
    <template v-else>
      <!-- 版本 -->
      <section class="about-card">
        <div class="about-brand">
          <AppLogo size="lg" :glow="true" />
          <div class="about-brand-text">
            <div class="about-name">{{ data.productName }}</div>
            <div class="about-tagline">{{ data.tagline }}</div>
            <div v-if="data.livingLine" class="about-living">{{ data.livingLine }}</div>
          </div>
        </div>
        <div class="about-version-row">
          <span class="about-label">当前版本</span>
          <el-tag type="info" effect="plain" round class="version-tag">v{{ data.version }}</el-tag>
        </div>
      </section>

      <!-- 特殊说明：完全本地 -->
      <section class="about-card about-card--local">
        <div class="local-kicker">特殊说明</div>
        <p class="local-title">本项目完全本地，不夹带任何后台服务</p>
        <p class="local-body">{{ data.localNote }}</p>
        <ul v-if="data.extraNotes?.length" class="local-extra">
          <li v-for="(n, i) in data.extraNotes" :key="i">{{ n }}</li>
        </ul>
      </section>

      <!-- 更新地址 -->
      <section class="about-card">
        <div class="section-title">更新地址</div>
        <template v-if="data.updateUrl">
          <el-link :href="data.updateUrl" type="primary" target="_blank" rel="noopener">
            {{ data.updateUrl }}
          </el-link>
          <div class="section-actions">
            <el-button size="small" @click="copy(data.updateUrl)">复制链接</el-button>
            <el-button size="small" type="primary" plain @click="openUrl(data.updateUrl)">
              打开
            </el-button>
          </div>
        </template>
        <p v-else class="muted">
          {{ data.updateHint || '暂未配置更新地址。' }}
        </p>
        <p class="muted tiny">
          不会自动联网检查更新；仅当你主动打开链接时才会访问网络。
        </p>
      </section>

      <!-- 版本日志 -->
      <section class="about-card">
        <div class="section-title">版本日志</div>
        <el-timeline v-if="data.changelog?.length">
          <el-timeline-item
            v-for="(entry, i) in data.changelog"
            :key="entry.version + String(i)"
            :timestamp="entry.date || ''"
            placement="top"
            :type="i === 0 ? 'primary' : 'info'"
            :hollow="i !== 0"
          >
            <div class="log-head">
              <strong>v{{ entry.version }}</strong>
              <span v-if="entry.title" class="log-title">{{ entry.title }}</span>
            </div>
            <ul class="log-items">
              <li v-for="(item, j) in entry.items || []" :key="j">{{ item }}</li>
            </ul>
          </el-timeline-item>
        </el-timeline>
        <p v-else class="muted">暂无版本日志。</p>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '../../api'
import AppLogo from '../../components/AppLogo.vue'

const data = ref({
  productName: 'oh-my-co-work',
  tagline: '人机协同 · 万物归元 · 皆可 Workflow',
  livingLine: '节点是死的，人是活的 — 流动的 Workflow，人可绕行、插队、临时协助再回来。',
  version: '—',
  updateUrl: '',
  updateHint: '',
  localNote: '',
  extraNotes: [],
  changelog: [],
})
const loading = ref(true)

function copy(t) {
  navigator.clipboard.writeText(t || '')
  ElMessage.success('已复制')
}

function openUrl(url) {
  if (url) window.open(url, '_blank', 'noopener')
}

onMounted(async () => {
  try {
    data.value = await api.about()
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.about-page {
  max-width: 640px;
}

.page-head {
  margin-bottom: 18px;
}

.page-title {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.03em;
}

.page-desc {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.about-loading {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  padding: 24px 0;
}

.about-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 16px;
  padding: 18px 20px 20px;
  margin-bottom: 14px;
  background: #fff;
}

.about-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}

.about-name {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.about-tagline {
  margin-top: 4px;
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
}

.about-living {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.45;
  color: #9a6414;
  max-width: 36em;
}

.about-version-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.about-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.version-tag {
  font-weight: 700;
  letter-spacing: 0.02em;
  font-size: 13px;
}

.about-card--local {
  background: linear-gradient(160deg, #f7f8fa 0%, #fff 70%);
  border-color: var(--el-border-color);
}

.local-kicker {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #8e8ea0;
  margin-bottom: 8px;
}

.local-title {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
  line-height: 1.45;
}

.local-body {
  margin: 0;
  font-size: 13.5px;
  color: var(--el-text-color-regular);
  line-height: 1.65;
}

.local-extra {
  margin: 12px 0 0;
  padding-left: 18px;
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.section-title {
  font-size: 14px;
  font-weight: 650;
  margin-bottom: 12px;
  letter-spacing: -0.02em;
}

.section-actions {
  margin-top: 10px;
  display: flex;
  gap: 8px;
}

.muted {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.55;
}

.muted.tiny {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.log-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
}

.log-title {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.log-items {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
}
</style>
