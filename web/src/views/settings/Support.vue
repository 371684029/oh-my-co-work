<template>
  <div class="support-page">
    <div class="page-head">
      <div>
        <h2 class="page-title">支持与交流</h2>
        <p class="page-desc">技术交流 · 反馈 · 一点点心意</p>
      </div>
    </div>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      :title="data.note || '欢迎技术交流与问题反馈。'"
      class="support-note"
    />

    <el-card shadow="never" class="support-card">
      <template #header>
        <span class="card-title">技术交流</span>
      </template>
      <div class="contact-row">
        <span class="contact-label">手机</span>
        <el-link type="primary" :href="'tel:' + data.phone">{{ data.phone || '—' }}</el-link>
        <el-button v-if="data.phone" link type="primary" @click="copy(data.phone)">复制</el-button>
      </div>
      <div class="contact-row">
        <span class="contact-label">微信</span>
        <span>{{ data.wechat || '—' }}</span>
        <el-button v-if="data.wechat" link type="primary" @click="copy(data.wechat)">复制</el-button>
      </div>
      <div v-if="data.wechatQrPath" class="wechat-qr-block">
        <p class="qr-caption">{{ data.wechatQrLabel || '微信扫码' }}</p>
        <img :src="data.wechatQrPath" class="qr-img qr-img--contact" alt="微信二维码" />
      </div>
    </el-card>

    <el-card shadow="never" class="support-card support-card--like">
      <template #header>
        <span class="card-title">{{ data.sponsorTitle || '点赞支持' }}</span>
      </template>
      <p class="like-hint">
        {{ data.sponsorHint || '完全自愿，不影响任何功能。' }}
      </p>
      <p class="like-sub">
        {{ data.sponsorSubHint || '若你愿意，期待一点点小惊喜 ✨' }}
      </p>

      <div v-if="sponsorQrItems.length" class="qr-list">
        <div v-for="(item, i) in sponsorQrItems" :key="i" class="qr-item">
          <p v-if="item.label" class="qr-caption">{{ item.label }}</p>
          <img :src="item.src" class="qr-img" :alt="item.label || '收款码'" />
        </div>
      </div>
      <p v-else class="like-placeholder">
        心意通道稍后再开 · 先聊技术也完全 OK
      </p>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '../../api'

const data = ref({})

const sponsorQrItems = computed(() => {
  const paths = data.value.sponsorQrPaths
  if (!Array.isArray(paths) || !paths.length) return []
  const labels = data.value.sponsorQrLabels
  return paths.map((src, i) => ({
    src,
    label: Array.isArray(labels) && labels[i] ? String(labels[i]) : '',
  }))
})

function copy(t) {
  navigator.clipboard.writeText(t || '')
  ElMessage.success('已复制')
}

onMounted(async () => {
  data.value = await api.support()
})
</script>

<style scoped>
.support-page {
  max-width: 560px;
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

.support-note {
  margin-bottom: 16px;
  border-radius: 12px;
}

.support-card {
  margin-bottom: 14px;
  border-radius: 14px;
  border-color: var(--el-border-color-lighter);
}

.card-title {
  font-weight: 600;
  letter-spacing: -0.02em;
}

.contact-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 12px;
  font-size: 14px;
}

.contact-row:last-child {
  margin-bottom: 0;
}

.contact-label {
  width: 40px;
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.support-card--like {
  background: linear-gradient(160deg, #fafbfc 0%, #fff 60%);
}

.like-hint {
  margin: 0 0 6px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.55;
}

.like-sub {
  margin: 0;
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
  letter-spacing: 0.01em;
}

.like-placeholder {
  margin: 14px 0 0;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.5;
}

.wechat-qr-block {
  margin-top: 14px;
}

.qr-caption {
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.qr-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 14px;
}

.qr-item {
  flex: 0 0 auto;
}

.qr-img {
  width: 148px;
  max-width: 100%;
  height: auto;
  max-height: 200px;
  object-fit: contain;
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter);
  background: #fff;
}

.qr-img--contact {
  max-height: 220px;
}
</style>
