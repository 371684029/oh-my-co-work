<template>
  <div class="about-page">
    <div class="page-head">
      <div>
        <h2 class="page-title">{{ aboutT('title') }}</h2>
        <p class="page-desc">{{ aboutT('desc') }}</p>
      </div>
    </div>

    <div v-if="loading" class="about-loading">{{ aboutT('loading') }}</div>
    <template v-else>
      <!-- Version -->
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
          {{ aboutT('credit1') }}
          <el-link
            href="https://github.com/xiongxianzhu/chatgpt-pets"
            type="primary"
            target="_blank"
            rel="noopener"
          >chatgpt-pets</el-link
          >{{ aboutT('credit2') }}
        </p>
        <div class="about-version-row">
          <span class="about-label">{{ aboutT('versionLabel') }}</span>
          <el-tag type="info" effect="plain" round class="version-tag">v{{ data.version }}</el-tag>
          <el-tag :type="isDesktop ? 'success' : 'info'" size="small" style="margin-left: 8px">
            {{ isDesktop ? aboutDesktopTag(desktopEnv) : aboutT('webTag') }}
          </el-tag>
        </div>
        <div class="update-row" style="margin-top: 12px">
          <el-button
            size="small"
            :aria-label="aboutT('a11y.diag')"
            :loading="diagLoading"
            @click="exportDiagnostics"
          >
            {{ aboutT('diagBtn') }}
          </el-button>
          <span class="muted tiny">{{ aboutT('diagHint') }}</span>
        </div>
      </section>

      <!-- Updates (4.2.0) -->
      <section class="about-card">
        <div class="section-title">{{ aboutT('updateSection') }}</div>

        <!-- Check for updates -->
        <div class="update-row">
          <el-button
            size="small"
            :aria-label="aboutT('a11y.check')"
            :loading="updateChecking"
            @click="checkUpdate"
          >
            {{ aboutT('checkBtn') }}
          </el-button>
          <template v-if="updateResult">
            <el-tag v-if="!updateResult.hasUpdate" type="success" effect="plain" round size="small">
              {{ aboutT('upToDate') }}
            </el-tag>
            <template v-else>
              <el-tag type="warning" effect="plain" round size="small">
                {{ aboutFoundNew(updateResult.latest) }}
              </el-tag>
              <div v-if="updateResult.notes" class="update-notes">{{ updateResult.notes }}</div>
              <div v-if="updateResult.date" class="update-date">{{ updateResult.date }}</div>
              <el-button v-if="updateResult.url" size="small" type="primary" plain @click="openUrl(updateResult.url)">
                {{ aboutT('openDownload') }}
              </el-button>
              <template v-if="isDesktop && updateResult.url">
                <el-button size="small" :loading="updateDownloading" @click="downloadDesktopUpdate">
                  {{ aboutT('downloadLocal') }}
                </el-button>
                <el-button size="small" type="warning" plain :loading="updateApplying" @click="applyOnQuit">
                  {{ aboutT('applyOnQuit') }}
                </el-button>
              </template>
            </template>
          </template>
          <span v-else class="muted tiny">{{ aboutT('updateHint') }}</span>
        </div>

        <!-- Backup and restore -->
        <div class="update-divider" />
        <div class="update-row">
          <el-button
            size="small"
            :aria-label="aboutT('a11y.backup')"
            :loading="backupCreating"
            @click="createBackupNow"
          >
            {{ aboutT('backupBtn') }}
          </el-button>
          <span v-if="lastBackupName" class="update-last-backup">{{ aboutLastBackup(lastBackupName) }}</span>
        </div>
        <div class="update-row" style="margin-top: 8px">
          <el-button size="small" :loading="backupsLoading" @click="loadBackupsForRestore">
            {{ aboutT('restoreBtn') }}
          </el-button>
          <el-select
            v-if="showRestoreSelect"
            v-model="selectedRestoreFile"
            :placeholder="aboutT('restorePlaceholder')"
            size="small"
            style="width: 280px; margin-left: 8px"
          >
            <el-option
              v-for="b in availableBackups"
              :key="b.filename"
              :label="aboutBackupOptionLabel(b.filename, b.format === 'dir', formatSize(b.bytes))"
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
            {{ aboutT('restoreGo') }}
          </el-button>
        </div>
      </section>

      <!-- Special note: fully local -->
      <section class="about-card about-card--local">
        <div class="local-kicker">{{ aboutT('localSection') }}</div>
        <p class="local-title">{{ aboutT('localTitle') }}</p>
        <p class="local-body">{{ data.localNote }}</p>
        <ul v-if="data.extraNotes?.length" class="local-extra">
          <li v-for="(n, i) in data.extraNotes" :key="i">{{ n }}</li>
        </ul>
      </section>

      <!-- Update URL -->
      <section class="about-card">
        <div class="section-title">{{ aboutT('updateUrlSection') }}</div>
        <template v-if="data.updateUrl">
          <el-link :href="data.updateUrl" type="primary" target="_blank" rel="noopener">
            {{ data.updateUrl }}
          </el-link>
          <div class="section-actions">
            <el-button size="small" @click="copy(data.updateUrl)">{{ aboutT('copyLink') }}</el-button>
            <el-button size="small" type="primary" plain @click="openUrl(data.updateUrl)">
              {{ aboutT('open') }}
            </el-button>
          </div>
        </template>
        <p v-else class="muted">
          {{ data.updateHint || aboutT('noUpdateUrl') }}
        </p>
        <p class="muted tiny">
          {{ aboutT('updateFootnote') }}
        </p>
      </section>

      <!-- Changelog -->
      <section class="about-card">
        <div class="section-title">{{ aboutT('changelogSection') }}</div>
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
        <p v-else class="muted">{{ aboutT('noChangelog') }}</p>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import ElMessage from 'element-plus/es/components/message/index.mjs'
import ElMessageBox from 'element-plus/es/components/message-box/index.mjs'
import { api } from '../../api'
import AppLogo from '../../components/AppLogo.vue'
import { useDesktopBridge } from '../../composables/useDesktopBridge.js'
import {
  aboutT,
  aboutToast,
  aboutConfirm,
  aboutConfirmCancel,
  aboutDefaultTagline,
  aboutDefaultLivingLine,
  aboutDesktopTag,
  aboutFoundNew,
  aboutDownloadOk,
  aboutLastBackup,
  aboutBackupOptionLabel,
  aboutRestoreConfirmBody,
} from '../../composables/settingsAboutCopy.js'

const { isDesktop, desktopEnv, initDesktopBridge, applyDesktopUpdate } = useDesktopBridge()
initDesktopBridge()

const data = ref({
  productName: 'oh-my-co-work',
  tagline: aboutDefaultTagline(),
  livingLine: aboutDefaultLivingLine(),
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
const diagLoading = ref(false)
const updateDownloading = ref(false)
const updateApplying = ref(false)

async function exportDiagnostics() {
  diagLoading.value = true
  try {
    const payload = await api.diagnostics()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `acw-diagnostics-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success(aboutToast('diagOk'))
  } catch (e) {
    ElMessage.error(e?.message || aboutToast('diagFail'))
  } finally {
    diagLoading.value = false
  }
}

function copy(t) {
  navigator.clipboard.writeText(t || '')
  ElMessage.success(aboutToast('copied'))
}

function openUrl(url) {
  if (url) window.open(url, '_blank', 'noopener')
}

// 4.2.0 update
async function checkUpdate() {
  updateChecking.value = true
  try {
    updateResult.value = await api.update.check()
  } catch (e) {
    ElMessage.error(e?.message || aboutToast('checkFail'))
  } finally {
    updateChecking.value = false
  }
}

async function downloadDesktopUpdate() {
  const u = updateResult.value
  if (!u?.url || !u?.latest) return
  updateDownloading.value = true
  try {
    const r = await applyDesktopUpdate({
      action: 'download',
      url: u.url,
      version: u.latest,
    })
    if (r?.ok) ElMessage.success(aboutDownloadOk(u.latest, Math.round((r.bytes || 0) / 1024 / 1024)))
    else ElMessage.warning(r?.reason || aboutToast('downloadFail'))
  } catch (e) {
    ElMessage.error(e?.message || aboutToast('downloadFail'))
  } finally {
    updateDownloading.value = false
  }
}

async function applyOnQuit() {
  updateApplying.value = true
  try {
    const r = await applyDesktopUpdate({ action: 'apply' })
    if (r?.ok) ElMessage.success(aboutToast('applyOk'))
    else ElMessage.warning(r?.reason || aboutToast('applyNeedDownload'))
  } catch (e) {
    ElMessage.error(e?.message || aboutToast('applyFail'))
  } finally {
    updateApplying.value = false
  }
}

async function createBackupNow() {
  backupCreating.value = true
  try {
    const r = await api.update.backup()
    lastBackupName.value = r.path || r.filename || aboutT('backupDoneFallback')
    ElMessage.success(aboutToast('backupOk'))
  } catch (e) {
    ElMessage.error(e?.message || aboutToast('backupFail'))
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
    ElMessage.error(e?.message || aboutToast('backupListFail'))
  } finally {
    backupsLoading.value = false
  }
}

async function doRestore() {
  if (!selectedRestoreFile.value) return
  try {
    await ElMessageBox.confirm(
      aboutRestoreConfirmBody(selectedRestoreFile.value),
      aboutConfirm('restoreTitle'),
      {
        type: 'warning',
        confirmButtonText: aboutConfirm('restoreOk'),
        cancelButtonText: aboutConfirmCancel(),
      },
    )
  } catch { return }
  restoreRunning.value = true
  try {
    await api.update.restore(selectedRestoreFile.value)
    ElMessage.success(aboutToast('restoreOk'))
    setTimeout(() => window.location.reload(), 1500)
  } catch (e) {
    ElMessage.error(e?.message || aboutToast('restoreFail'))
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
    ElMessage.error(e.message || aboutToast('loadFail'))
  } finally {
    loading.value = false
  }
  try {
    const r = await api.update.backups()
    if (r?.backups?.length) {
      lastBackupName.value = r.backups[0].filename
    }
  } catch {
    /* ignore */
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
