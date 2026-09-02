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
        <p class="about-credit">
          熔炉桌宠立绘（李慕婉）复制自
          <el-link
            href="https://github.com/xiongxianzhu/chatgpt-pets"
            type="primary"
            target="_blank"
            rel="noopener"
          >chatgpt-pets</el-link>
          git 仓库。© 2026 zhuxiongxian / chatgpt-pets 贡献者 · MIT。
        </p>
        <div class="about-version-row">
          <span class="about-label">当前版本</span>
          <el-tag type="info" effect="plain" round class="version-tag">v{{ data.version }}</el-tag>
        </div>
      </section>

      <!-- 更新 (4.2.0) -->
      <section class="about-card">
        <div class="section-title">更新</div>

        <!-- 检查更新 -->
        <div class="update-row">
          <el-button size="small" :loading="updateChecking" @click="checkUpdate">
            检查更新
          </el-button>
          <template v-if="updateResult">
            <el-tag v-if="!updateResult.hasUpdate" type="success" effect="plain" round size="small">
              已是最新
            </el-tag>
            <template v-else>
              <el-tag type="warning" effect="plain" round size="small">
                发现新版本 v{{ updateResult.latest }}
              </el-tag>
              <div v-if="updateResult.notes" class="update-notes">{{ updateResult.notes }}</div>
              <div v-if="updateResult.date" class="update-date">{{ updateResult.date }}</div>
              <el-button v-if="updateResult.url" size="small" type="primary" plain @click="openUrl(updateResult.url)">
                打开下载页
              </el-button>
            </template>
          </template>
          <span v-else class="muted tiny">启动时也会检查（设置可关）；只读版本号，不自动安装</span>
        </div>

        <!-- 备份与恢复 -->
        <div class="update-divider" />
        <div class="update-row">
          <el-button size="small" :loading="backupCreating" @click="createBackupNow">
            立即备份
          </el-button>
          <span v-if="lastBackupName" class="update-last-backup">最近备份：{{ lastBackupName }}</span>
        </div>
        <div class="update-row" style="margin-top: 8px">
          <el-button size="small" :loading="backupsLoading" @click="loadBackupsForRestore">
            从备份恢复
          </el-button>
          <el-select
            v-if="showRestoreSelect"
            v-model="selectedRestoreFile"
            placeholder="选择备份文件"
            size="small"
            style="width: 280px; margin-left: 8px"
          >
            <el-option
              v-for="b in availableBackups"
              :key="b.filename"
              :label="`${b.filename}${b.format === 'dir' ? ' · 目录' : ''}（${formatSize(b.bytes)}）`"
              :value="b.filename"
            />
          </el-select>
          <el-button
            v-if="selectedRestoreFile"
            size="small"
            type="danger"
            plain
            :loading="restoreRunning"
            @click="doRestore"
          >
            恢复
          </el-button>
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
          启动检查默认可关。检查只向 GitHub Releases 读取版本号，不上传数据、不自动下载安装。「更新地址」仅在你主动打开时访问。
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
import { ElMessage, ElMessageBox } from 'element-plus'
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
// 4.2.0 更新
const updateChecking = ref(false)
const updateResult = ref(null)
const backupCreating = ref(false)
const lastBackupName = ref('')
const backupsLoading = ref(false)
const availableBackups = ref([])
const showRestoreSelect = ref(false)
const selectedRestoreFile = ref('')
const restoreRunning = ref(false)

function copy(t) {
  navigator.clipboard.writeText(t || '')
  ElMessage.success('已复制')
}

function openUrl(url) {
  if (url) window.open(url, '_blank', 'noopener')
}

// 4.2.0 更新
async function checkUpdate() {
  updateChecking.value = true
  try {
    updateResult.value = await api.update.check()
  } catch (e) {
    ElMessage.error(e?.message || '检查更新失败')
  } finally {
    updateChecking.value = false
  }
}

async function createBackupNow() {
  backupCreating.value = true
  try {
    const r = await api.update.backup()
    lastBackupName.value = r.path || r.filename || '备份完成'
    ElMessage.success('备份成功')
  } catch (e) {
    ElMessage.error(e?.message || '备份失败')
  } finally {
    backupCreating.value = false
  }
}

async function loadBackupsForRestore() {
  backupsLoading.value = true
  try {
    const r = await api.update.backups()
    availableBackups.value = r.backups || []
    showRestoreSelect.value = true
    selectedRestoreFile.value = ''
  } catch (e) {
    ElMessage.error(e?.message || '加载备份列表失败')
  } finally {
    backupsLoading.value = false
  }
}

async function doRestore() {
  if (!selectedRestoreFile.value) return
  try {
    await ElMessageBox.confirm(
      `确定从备份 ${selectedRestoreFile.value} 恢复？当前数据会被覆盖（恢复前会自动再备份一次）。`,
      '从备份恢复',
      { type: 'warning', confirmButtonText: '确认恢复', cancelButtonText: '取消' },
    )
  } catch { return }
  restoreRunning.value = true
  try {
    await api.update.restore(selectedRestoreFile.value)
    ElMessage.success('恢复完成，正在重启应用…')
    setTimeout(() => window.location.reload(), 1500)
  } catch (e) {
    ElMessage.error(e?.message || '恢复失败')
  } finally {
    restoreRunning.value = false
  }
}

function formatSize(n) {
  const b = Number(n) || 0
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
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

.about-credit {
  margin: 0 0 16px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--el-text-color-secondary);
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

/* 4.2.0 更新卡 */
.update-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 13px;
}

.update-notes {
  width: 100%;
  margin-top: 6px;
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
  word-break: break-word;
}

.update-date {
  width: 100%;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}

.update-last-backup {
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
}

.update-divider {
  height: 1px;
  background: var(--el-border-color-lighter);
  margin: 14px 0;
}
</style>
