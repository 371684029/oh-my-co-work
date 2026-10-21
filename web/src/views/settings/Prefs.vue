<template>
  <div class="prefs-page">
    <div class="page-head">
      <div>
        <h2 class="page-title">{{ prefsTitle() }}</h2>
        <p class="page-desc">{{ prefsDesc() }}</p>
      </div>
    </div>

    <section class="prefs-card">
      <div class="prefs-row">
        <div class="prefs-text">
          <div class="prefs-title">{{ prefsT('runtime.title') }}</div>
          <p class="prefs-hint">
            {{ prefsRuntimeHintDesktopPrefix() }}
            <strong>{{
              isDesktop ? prefsRuntimeHintDesktopStrong(desktopEnv) : prefsRuntimeHintWebStrong()
            }}</strong>。
            <span v-if="isDesktop">{{ prefsRuntimeHintDesktopSuffix() }}</span>
            <span v-else>{{ prefsRuntimeHintWebSuffix() }}</span>
          </p>
        </div>
        <el-tag :type="isDesktop ? 'success' : 'info'" size="small">
          {{ isDesktop ? desktopEnv : 'Web' }}
        </el-tag>
      </div>
    </section>

    <section v-if="isDesktop" class="prefs-card">
      <div class="prefs-title">{{ prefsT('dataDir.title') }}</div>
      <p class="prefs-hint">{{ prefsT('dataDir.hint') }}</p>
      <pre v-if="dataDirInfo" class="usage-pre">{{ dataDirSummary }}</pre>
      <el-button
        v-if="dataDirInfo?.hasLegacy && !dataDirInfo?.migrated"
        size="small"
        type="warning"
        :loading="migratingData"
        @click="migrateData"
      >
        {{ prefsT('dataDir.migrate') }}
      </el-button>
    </section>

    <section class="prefs-card">
      <div class="prefs-row">
        <div class="prefs-text">
          <div class="prefs-title">{{ prefsT('demo.title') }}</div>
          <p class="prefs-hint">{{ prefsT('demo.hint') }}</p>
        </div>
        <el-switch
          v-model="showDemo"
          :loading="saving"
          inline-prompt
          :active-text="prefsT('demo.switchOn')"
          :inactive-text="prefsT('demo.switchOff')"
          @change="onToggleDemo"
        />
      </div>
    </section>

    <section class="prefs-card">
      <div class="prefs-row">
        <div class="prefs-text">
          <div class="prefs-title">{{ prefsT('startupUpdate.title') }}</div>
          <p class="prefs-hint">
            {{ prefsT('startupUpdate.hint') }}
          </p>
        </div>
        <el-switch
          v-model="startupUpdateCheck"
          :loading="savingStartupUpdate"
          inline-prompt
          :active-text="prefsT('startupUpdate.switchOn')"
          :inactive-text="prefsT('startupUpdate.switchOff')"
          @change="onToggleStartupUpdate"
        />
      </div>
    </section>

    <section v-if="isDesktop" class="prefs-card">
      <div class="prefs-title">{{ prefsT('notify.title') }}</div>
      <p class="prefs-hint">
        {{ prefsT('notify.hint') }}
      </p>
      <el-form label-position="top" class="admin-form">
        <el-form-item :label="prefsT('notify.enable')">
          <el-switch v-model="notifyPrefs.enabled" />
        </el-form-item>
        <el-form-item :label="prefsT('notify.onlyUnfocused')">
          <el-switch v-model="notifyPrefs.onlyWhenUnfocused" :disabled="!notifyPrefs.enabled" />
        </el-form-item>
        <el-form-item :label="prefsT('notify.types')">
          <el-checkbox v-model="notifyPrefs.levels.action" :disabled="!notifyPrefs.enabled">
            {{ prefsT('notify.levelAction') }}
          </el-checkbox>
          <el-checkbox v-model="notifyPrefs.levels.error" :disabled="!notifyPrefs.enabled">
            {{ prefsT('notify.levelError') }}
          </el-checkbox>
          <el-checkbox v-model="notifyPrefs.levels.done" :disabled="!notifyPrefs.enabled">
            {{ prefsT('notify.levelDone') }}
          </el-checkbox>
        </el-form-item>
      </el-form>
      <el-alert
        v-if="notifyPlatform.hint"
        class="notify-platform-hint"
        type="info"
        :closable="false"
        show-icon
        :title="notifyPlatform.hint"
      />
      <div class="prefs-actions">
        <el-button type="primary" plain size="small" :loading="savingNotify" @click="saveNotify">
          {{ prefsT('notify.save') }}
        </el-button>
        <el-button size="small" :disabled="!notifyPrefs.enabled" @click="sendTestNotify">
          {{ prefsT('notify.test') }}
        </el-button>
      </div>
      <p class="prefs-hint" style="margin-top: 8px">
        {{ prefsT('notify.footnote') }}
      </p>
    </section>

    <section class="prefs-card">
      <div class="prefs-title">{{ prefsT('usage.title') }}</div>
      <p class="prefs-hint">{{ prefsT('usage.hint') }}</p>
      <el-button size="small" :loading="usageLoading" @click="loadUsageStats">{{ prefsT('usage.refresh') }}</el-button>
      <pre v-if="usageStats" class="usage-pre">{{ usageSummaryText }}</pre>
    </section>

    <section class="prefs-card">
      <div class="prefs-row">
        <div class="prefs-text">
          <div class="prefs-title">{{ prefsT('scriptPopup.title') }}</div>
          <p class="prefs-hint">
            {{ prefsT('scriptPopup.hint') }}
          </p>
        </div>
        <el-switch
          v-model="showScriptPopup"
          :loading="savingPopup"
          inline-prompt
          :active-text="prefsT('scriptPopup.switchYes')"
          :inactive-text="prefsT('scriptPopup.switchNo')"
          @change="onToggleScriptPopup"
        />
      </div>
    </section>

    <section class="prefs-card">
      <div class="prefs-title">{{ prefsT('resources.title') }}</div>
      <p class="prefs-hint">
        {{ prefsT('resources.hint') }}
      </p>
      <el-form label-position="top" class="admin-form">
        <el-form-item :label="prefsT('resources.occupiedLabel')">
          <el-select
            v-model="selectedSessionIds"
            multiple
            filterable
            clearable
            collapse-tags
            collapse-tags-tooltip
            :placeholder="prefsT('resources.placeholder')"
            style="width: 100%"
          >
            <el-option
              v-for="item in occupied"
              :key="item.sessionId"
              :label="resourceLabel(item)"
              :value="item.sessionId"
            />
          </el-select>
          <p v-if="!occupied.length" class="prefs-resolved">{{ prefsT('resources.empty') }}</p>
        </el-form-item>
      </el-form>
      <div class="prefs-actions">
        <el-button
          type="primary"
          plain
          size="small"
          :disabled="!selectedSessionIds.length"
          :loading="releasing"
          @click="releaseSelected"
        >
          {{ prefsT('resources.releaseSelected') }}
        </el-button>
        <el-button
          type="danger"
          plain
          size="small"
          :disabled="!occupied.length"
          :loading="releasing"
          @click="releaseAll"
        >
          {{ prefsT('resources.releaseAll') }}
        </el-button>
        <el-button size="small" text :loading="loadingResources" @click="loadResources">
          {{ prefsT('resources.refresh') }}
        </el-button>
      </div>
    </section>

    <section class="prefs-card">
      <div class="prefs-title">{{ prefsT('furnace.title') }}</div>
      <p class="prefs-hint">
        {{ prefsT('furnace.hint') }}
      </p>
      <el-form label-position="top" class="admin-form">
        <el-form-item :label="prefsT('furnace.defaultMember')">
          <el-select
            v-model="adminMemberId"
            clearable
            filterable
            :placeholder="prefsT('furnace.memberPlaceholder')"
            style="width: 100%"
            @change="onAdminChange"
          >
            <el-option
              v-for="m in members"
              :key="m.id"
              :label="m.display_name"
              :value="m.id"
            />
          </el-select>
          <p v-if="resolvedHintText" class="prefs-resolved">{{ resolvedHintText }}</p>
        </el-form-item>
        <el-form-item :label="prefsT('furnace.defaultFlow')">
          <el-checkbox-group v-model="defaultFlowKeys" @change="onAdminChange">
            <el-checkbox value="admin">{{ prefsT('furnace.flowAdmin') }}</el-checkbox>
            <el-checkbox value="auto">{{ prefsT('furnace.flowAuto') }}</el-checkbox>
            <el-checkbox value="human">{{ prefsT('furnace.flowHuman') }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <el-button type="primary" plain size="small" :loading="savingAdmin" @click="saveAdmin">
        {{ prefsT('furnace.save') }}
      </el-button>
    </section>

    <section class="prefs-card">
      <div class="prefs-title">{{ prefsT('grok.title') }}</div>
      <p class="prefs-hint">
        {{ prefsT('grok.hintPrefix') }}
        <router-link to="/settings/grok">{{ prefsT('grok.hintLink') }}</router-link>。
      </p>
      <el-form label-position="top" class="admin-form">
        <el-form-item :label="prefsT('grok.configured')">
          <el-switch v-model="grok.configured" />
          <p class="prefs-resolved">{{ prefsT('grok.configuredHint') }}</p>
        </el-form-item>
        <el-form-item :label="prefsT('grok.command')">
          <el-input v-model="grok.command" placeholder="grok" />
        </el-form-item>
        <el-form-item :label="prefsT('grok.cursorCommand')">
          <el-input v-model="grok.cursorCommand" placeholder="cursor-agent" />
          <p class="prefs-resolved">{{ prefsT('grok.cursorHint') }}</p>
        </el-form-item>
        <el-form-item :label="prefsT('grok.defaultSurface')">
          <el-radio-group v-model="grok.surface">
            <el-radio value="tui">{{ prefsT('grok.surfaceTui') }}</el-radio>
          </el-radio-group>
          <p class="prefs-resolved">{{ prefsT('grok.surfaceHint') }}</p>
        </el-form-item>
        <el-form-item :label="prefsT('grok.adaptBackup')">
          <el-switch v-model="adaptBackup" />
          <p class="prefs-resolved">{{ prefsT('grok.adaptBackupHint') }}</p>
        </el-form-item>
      </el-form>
      <el-button type="primary" plain size="small" :loading="savingGrok" @click="saveGrok">
        {{ prefsT('grok.save') }}
      </el-button>
    </section>

    <section class="prefs-card">
      <div class="prefs-title">{{ prefsT('locale.title') }}</div>
      <p class="prefs-hint">{{ prefsT('locale.hint') }}</p>
      <el-form label-position="top" class="admin-form">
        <el-form-item :label="prefsT('locale.label')">
          <el-select
            v-model="uiLocale"
            style="max-width: 280px"
            :aria-label="prefsT('locale.selectAria')"
            @change="onLocaleChange"
          >
            <el-option
              v-for="o in localeOptions"
              :key="o.value"
              :label="o.label"
              :value="o.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
    </section>

    <section class="prefs-card">
      <div class="prefs-title">{{ prefsT('perf.title') }}</div>
      <p class="prefs-hint">{{ prefsT('perf.hint') }}</p>
      <el-form label-position="top" class="admin-form">
        <el-form-item :label="prefsT('perf.reduceEffects')">
          <el-switch v-model="ui.reduceEffects" @change="saveUi" />
        </el-form-item>
        <el-form-item :label="prefsT('perf.colorScheme')">
          <el-segmented
            v-model="ui.colorScheme"
            :options="colorSchemeOptions"
            @change="saveUi"
          />
        </el-form-item>
      </el-form>
    </section>

    <section class="prefs-card">
      <div class="prefs-title">{{ prefsT('terminal.title') }}</div>
      <p class="prefs-hint">{{ prefsT('terminal.hint') }}</p>
      <el-form label-position="top" class="admin-form">
        <el-form-item :label="prefsT('terminal.theme')">
          <el-select v-model="terminal.theme" style="width: 100%">
            <el-option :label="prefsT('terminal.themeProjectDark')" value="project-dark" />
            <el-option :label="prefsT('terminal.themeNative')" value="native" />
            <el-option :label="prefsT('terminal.themeHighContrast')" value="high-contrast" />
          </el-select>
        </el-form-item>
        <el-form-item :label="prefsT('terminal.fontSize')">
          <el-input-number v-model="terminal.fontSize" :min="10" :max="22" />
        </el-form-item>
        <el-form-item :label="prefsT('terminal.fontFamily')">
          <el-input v-model="terminal.fontFamily" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item :label="prefsT('terminal.lineHeight')">
          <el-input-number v-model="terminal.lineHeight" :min="1" :max="2" :step="0.05" />
        </el-form-item>
        <el-form-item :label="prefsT('terminal.letterSpacing')">
          <el-input-number v-model="terminal.letterSpacing" :min="-1" :max="4" :step="0.1" />
        </el-form-item>
        <el-form-item :label="prefsT('terminal.renderer')">
          <el-select v-model="terminal.renderer" style="width: 100%">
            <el-option :label="prefsT('terminal.rendererWebgl')" value="webgl" />
            <el-option :label="prefsT('terminal.rendererDom')" value="dom" />
          </el-select>
        </el-form-item>
        <el-form-item :label="prefsT('terminal.cursorBlink')">
          <el-switch v-model="terminal.cursorBlink" />
        </el-form-item>
        <el-form-item :label="prefsT('terminal.pastePolicy')">
          <el-select v-model="terminal.pastePolicy" style="width: 100%">
            <el-option :label="prefsT('terminal.pasteConfirm')" value="confirm" />
            <el-option :label="prefsT('terminal.pasteAllow')" value="allow" />
          </el-select>
        </el-form-item>
        <el-form-item :label="prefsT('terminal.autoCollapse')">
          <el-switch v-model="terminal.autoCollapseOnExit" />
        </el-form-item>
      </el-form>
      <el-button type="primary" plain size="small" :loading="savingTerminal" @click="saveTerminal">
        {{ prefsT('terminal.save') }}
      </el-button>
    </section>

    <section class="prefs-card">
      <div class="prefs-title">{{ prefsT('quota.title') }}</div>
      <p class="prefs-hint">{{ prefsT('quota.hint') }}</p>
      <el-form label-position="top" class="admin-form">
        <el-form-item :label="prefsT('quota.maxTerminals')">
          <el-input-number v-model="quota.maxConcurrentTerminals" :min="1" :max="32" />
        </el-form-item>
        <el-form-item :label="prefsT('quota.maxLogMiB')">
          <el-input-number v-model="quota.maxLogMiB" :min="1" :max="200" />
        </el-form-item>
        <el-form-item :label="prefsT('quota.maxReplayKiB')">
          <el-input-number v-model="quota.maxReplayKiB" :min="32" :max="2048" />
        </el-form-item>
        <el-form-item :label="prefsT('quota.redact')">
          <el-switch v-model="redact.enabled" />
        </el-form-item>
        <el-form-item :label="prefsT('quota.patterns')">
          <el-input
            v-model="redact.patternsText"
            type="textarea"
            :rows="3"
            :placeholder="prefsT('quota.patternsPlaceholder')"
          />
        </el-form-item>
      </el-form>
      <el-button type="primary" plain size="small" :loading="savingQuota" @click="saveQuota">
        {{ prefsT('quota.save') }}
      </el-button>
    </section>

    <!-- 一键导入与一键导出 -->
    <section class="prefs-card">
      <div class="prefs-title">{{ prefsT('backup.title') }}</div>
      <p class="prefs-hint">{{ prefsT('backup.hint') }}</p>

      <div class="backup-export-grid">
        <div class="be-card">
          <div class="be-card-head">
            <span class="be-card-badge">{{ prefsT('backup.importBadge') }}</span>
            <div class="be-card-title">{{ prefsT('backup.importTitle') }}</div>
          </div>
          <p class="be-card-desc">{{ prefsT('backup.importDesc') }}</p>
          <div class="be-card-actions">
            <el-button type="primary" size="default" :loading="importing" @click="pickImportFile">
              {{ prefsT('backup.importBtn') }}
            </el-button>
            <input
              ref="importInput"
              type="file"
              accept=".gz,.tar.gz,application/gzip"
              style="display: none"
              @change="onImportFile"
            />
          </div>
          <div v-if="lastImportTime" class="be-last-info">
            {{ prefsBackupImportLast(lastImportTime) }}
          </div>
        </div>

        <!-- 一键导出区块 -->
        <div class="be-card">
          <div class="be-card-head">
            <span class="be-card-badge be-card-badge--export">{{ prefsT('backup.exportBadge') }}</span>
            <div class="be-card-title">{{ prefsT('backup.exportTitle') }}</div>
          </div>
          <p class="be-card-desc">{{ prefsT('backup.exportDesc') }}</p>
          <div class="be-card-actions">
            <el-button
              type="success"
              size="default"
              plain
              :loading="exportingDocs"
              @click="onOneClickExportDocs"
            >
              {{ prefsT('backup.exportBtn') }}
            </el-button>
          </div>
          <div v-if="lastExportTime" class="be-last-info">
            {{ prefsBackupExportLast(lastExportTime) }}
          </div>
        </div>
      </div>
    </section>

    <section class="prefs-card prefs-card--danger">
      <div class="prefs-title">{{ prefsT('purge.title') }}</div>
      <p class="prefs-hint">{{ prefsT('purge.hint') }}</p>
      <el-button type="danger" plain :loading="purging" @click="onPurge">
        {{ prefsT('purge.btn') }}
      </el-button>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../../api'
import { useDesktopBridge } from '../../composables/useDesktopBridge.js'
import { loadNotificationPrefs } from '../../composables/useNotificationPrefs.js'
import { applyColorScheme, normalizeColorScheme } from '../../composables/uiColorScheme.js'
import { getLocale, setLocale, LOCALE_OPTIONS } from '../../i18n/index.js'
import {
  prefsTitle,
  prefsDesc,
  prefsT,
  prefsRuntimeHintDesktopPrefix,
  prefsRuntimeHintDesktopStrong,
  prefsRuntimeHintDesktopSuffix,
  prefsRuntimeHintWebStrong,
  prefsRuntimeHintWebSuffix,
  prefsDataDirSummary,
  prefsColorSchemeOptions,
  prefsResourceLabel,
  prefsUsageSummaryText,
  prefsResolvedHint,
  prefsToast,
  prefsConfirm,
  prefsConfirmCancel,
  prefsImportConfirmBody,
  prefsReleaseOk,
  prefsBackupImportLast,
  prefsBackupExportLast,
  prefsTestNotifyTitle,
  prefsTestNotifyBody,
} from '../../composables/settingsPrefsCopy.js'

const { isDesktop, desktopEnv, initDesktopBridge, notify: desktopNotify } = useDesktopBridge()
initDesktopBridge()

const showDemo = ref(true)
const showScriptPopup = ref(true)
const saving = ref(false)
const savingPopup = ref(false)
const savingAdmin = ref(false)
const purging = ref(false)
const members = ref([])
const adminMemberId = ref(null)
const defaultFlowKeys = ref(['admin', 'auto', 'human'])
const resolvedAdmin = ref(null)
const occupied = ref([])
const selectedSessionIds = ref([])
const releasing = ref(false)
const loadingResources = ref(false)
const terminal = ref({
  theme: 'project-dark',
  fontSize: 13,
  fontFamily: '',
  lineHeight: 1.35,
  letterSpacing: 0.2,
  renderer: 'webgl',
  cursorBlink: true,
  pastePolicy: 'confirm',
  autoCollapseOnExit: false,
  scrollback: 5000,
})
const quota = ref({
  maxConcurrentTerminals: 8,
  maxLogMiB: 10,
  maxReplayKiB: 256,
})
const redact = ref({ enabled: true, patternsText: '' })
const colorSchemeOptions = computed(() => prefsColorSchemeOptions())
const ui = ref({ reduceEffects: false, colorScheme: 'system' })
const uiLocale = ref(getLocale())
const localeOptions = LOCALE_OPTIONS

function onLocaleChange(value) {
  setLocale(value)
  window.location.reload()
}
const savingUi = ref(false)
const savingTerminal = ref(false)
const savingQuota = ref(false)
const importing = ref(false)
const importInput = ref(null)
const lastImportTime = ref('')
const exportingDocs = ref(false)
const lastExportTime = ref('')
const grok = ref({ command: 'grok', cursorCommand: 'cursor-agent', configured: true, surface: 'tui' })
const adaptBackup = ref(true)
const savingGrok = ref(false)
const startupUpdateCheck = ref(true)
const savingStartupUpdate = ref(false)
const notifyPrefs = ref({
  enabled: true,
  onlyWhenUnfocused: true,
  levels: { action: true, error: true, done: false },
})
const savingNotify = ref(false)
const notifyPlatform = ref({ supported: true, platform: 'web', hint: '' })
const dataDirInfo = ref(null)
const migratingData = ref(false)
const dataDirSummary = computed(() => prefsDataDirSummary(dataDirInfo.value))

const usageLoading = ref(false)
const usageStats = ref(null)
const usageSummaryText = computed(() => prefsUsageSummaryText(usageStats.value))

const resolvedHintText = computed(() =>
  prefsResolvedHint(resolvedAdmin.value, adminMemberId.value),
)

async function load() {
  try {
    const [s, m] = await Promise.all([api.appSettings.get(), api.members.list()])
    showDemo.value = s.showDemo !== false
    showScriptPopup.value = s.showScriptPopup !== false
    members.value = m || []
    resolvedAdmin.value = s.resolvedAdmin || null
    const a = s.admin || {}
    adminMemberId.value = a.memberId || s.resolvedAdmin?.id || null
    const f = a.defaultFlow || { admin: true, auto: true, human: true }
    const keys = []
    if (f.admin !== false) keys.push('admin')
    if (f.auto !== false) keys.push('auto')
    if (f.human !== false) keys.push('human')
    defaultFlowKeys.value = keys.length ? keys : ['auto']
    if (s.ui) {
      ui.value = {
        reduceEffects: !!s.ui.reduceEffects,
        colorScheme: normalizeColorScheme(s.ui.colorScheme),
      }
      applyColorScheme(ui.value.colorScheme)
    }
    if (s.terminal) {
      terminal.value = {
        theme: s.terminal.theme || 'project-dark',
        fontSize: s.terminal.fontSize || 13,
        fontFamily: s.terminal.fontFamily || '',
        lineHeight: s.terminal.lineHeight ?? 1.35,
        letterSpacing: s.terminal.letterSpacing ?? 0.2,
        renderer: s.terminal.renderer === 'dom' ? 'dom' : 'webgl',
        cursorBlink: s.terminal.cursorBlink !== false,
        pastePolicy: s.terminal.pastePolicy || 'confirm',
        autoCollapseOnExit: !!s.terminal.autoCollapseOnExit,
        scrollback: s.terminal.scrollback || 5000,
      }
    }
    if (s.grok) {
      grok.value = {
        command: s.grok.command || 'grok',
        cursorCommand: s.grok.cursorCommand || 'cursor-agent',
        configured: !!s.grok.configured,
        surface: s.grok.surface === 'chat' ? 'chat' : 'tui',
      }
    }
    adaptBackup.value = s.adapt?.backup !== false
    startupUpdateCheck.value = s.updateCheck?.startup !== false
    if (s.notifications) {
      const n = s.notifications
      notifyPrefs.value = {
        enabled: n.enabled !== false,
        onlyWhenUnfocused: n.onlyWhenUnfocused !== false,
        levels: {
          action: n.levels?.action !== false,
          error: n.levels?.error !== false,
          done: n.levels?.done === true,
        },
      }
    }
    if (s.quota) {
      quota.value = {
        maxConcurrentTerminals: s.quota.maxConcurrentTerminals || 8,
        maxLogMiB: s.quota.maxLogMiB || 10,
        maxReplayKiB: s.quota.maxReplayKiB || 256,
      }
    }
    if (s.redact) {
      redact.value = {
        enabled: s.redact.enabled !== false,
        patternsText: s.redact.patternsText || '',
      }
    }
    await loadResources()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

function resourceLabel(item) {
  return prefsResourceLabel(item)
}

async function loadResources({ quiet = false } = {}) {
  if (!quiet) loadingResources.value = true
  try {
    const r = await api.resources.list()
    occupied.value = r.items || []
    const live = new Set(occupied.value.map((i) => i.sessionId))
    selectedSessionIds.value = selectedSessionIds.value.filter((id) => live.has(id))
  } catch (e) {
    if (!quiet) ElMessage.error(e.message)
  } finally {
    if (!quiet) loadingResources.value = false
  }
}

async function releaseSelected() {
  if (!selectedSessionIds.value.length) {
    ElMessage.warning(prefsToast('releasePick'))
    return
  }
  releasing.value = true
  try {
    const r = await api.resources.release(selectedSessionIds.value)
    ElMessage.success(prefsReleaseOk(r.released || selectedSessionIds.value.length))
    selectedSessionIds.value = []
    await loadResources()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    releasing.value = false
  }
}

async function releaseAll() {
  try {
    await ElMessageBox.confirm(prefsConfirm('releaseAllBody'), prefsConfirm('releaseAllTitle'), {
      type: 'warning',
      confirmButtonText: prefsConfirm('releaseAllConfirm'),
      cancelButtonText: prefsConfirmCancel(),
    })
  } catch {
    return
  }
  releasing.value = true
  try {
    const r = await api.resources.release([])
    ElMessage.success(prefsReleaseOk(r.released || 0))
    selectedSessionIds.value = []
    await loadResources()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    releasing.value = false
  }
}

async function onToggleDemo(val) {
  saving.value = true
  try {
    const s = await api.appSettings.update({ showDemo: !!val })
    showDemo.value = s.showDemo !== false
    ElMessage.success(prefsToast(showDemo.value ? 'demoShown' : 'demoHidden'))
  } catch (e) {
    showDemo.value = !val
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

async function onToggleScriptPopup(val) {
  savingPopup.value = true
  try {
    const s = await api.appSettings.update({ showScriptPopup: !!val })
    showScriptPopup.value = s.showScriptPopup !== false
    ElMessage.success(prefsToast(showScriptPopup.value ? 'scriptPopupOn' : 'scriptPopupOff'))
  } catch (e) {
    showScriptPopup.value = !val
    ElMessage.error(e.message)
  } finally {
    savingPopup.value = false
  }
}

async function saveUi() {
  savingUi.value = true
  try {
    ui.value.colorScheme = normalizeColorScheme(ui.value.colorScheme)
    await api.appSettings.update({ ui: { ...ui.value } })
    applyColorScheme(ui.value.colorScheme)
    ElMessage.success(prefsToast('uiSaved'))
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    savingUi.value = false
  }
}

async function saveTerminal() {
  savingTerminal.value = true
  try {
    await api.appSettings.update({ terminal: { ...terminal.value } })
    ElMessage.success(prefsToast('terminalSaved'))
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    savingTerminal.value = false
  }
}

async function saveQuota() {
  savingQuota.value = true
  try {
    await api.appSettings.update({
      quota: { ...quota.value },
      redact: { ...redact.value },
    })
    ElMessage.success(prefsToast('quotaSaved'))
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    savingQuota.value = false
  }
}

function pickImportFile() {
  importInput.value?.click()
}

async function onImportFile(ev) {
  const file = ev.target.files?.[0]
  ev.target.value = ''
  if (!file) return
  try {
    await ElMessageBox.confirm(prefsImportConfirmBody(file.name), prefsConfirm('importTitle'), {
      type: 'warning',
      confirmButtonText: prefsConfirm('importConfirm'),
      cancelButtonText: prefsConfirmCancel(),
    })
  } catch {
    return
  }
  importing.value = true
  try {
    await api.backup.import(file)
    lastImportTime.value = new Date().toLocaleTimeString()
    ElMessage.success(prefsToast('importOk'))
    setTimeout(() => window.location.reload(), 800)
  } catch (e) {
    ElMessage.error(e?.message || prefsToast('importFail'))
  } finally {
    importing.value = false
  }
}

async function onOneClickExportDocs() {
  exportingDocs.value = true
  try {
    await api.docs.downloadAllDocsExport()
    lastExportTime.value = new Date().toLocaleTimeString()
    ElMessage.success(prefsToast('exportOk'))
  } catch (e) {
    ElMessage.error(e?.message || prefsToast('exportFail'))
  } finally {
    exportingDocs.value = false
  }
}


function onAdminChange() {
  /* 点保存再提交 */
}

async function saveAdmin() {
  savingAdmin.value = true
  try {
    const set = new Set(defaultFlowKeys.value || [])
    const s = await api.appSettings.update({
      admin: {
        memberId: adminMemberId.value || null,
        memberKey: 'unified_admin',
        defaultFlow: {
          admin: set.has('admin'),
          auto: set.has('auto'),
          human: set.has('human'),
        },
      },
    })
    resolvedAdmin.value = s.resolvedAdmin || null
    ElMessage.success(prefsToast('furnaceSaved'))
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    savingAdmin.value = false
  }
}

async function saveGrok() {
  savingGrok.value = true
  try {
    const s = await api.appSettings.update({
      grok: {
        command: String(grok.value.command || 'grok').trim() || 'grok',
        cursorCommand: String(grok.value.cursorCommand || 'cursor-agent').trim() || 'cursor-agent',
        configured: !!grok.value.configured,
        surface: grok.value.surface === 'chat' ? 'chat' : 'tui',
      },
      adapt: { backup: adaptBackup.value !== false },
    })
    if (s.grok) {
      grok.value = {
        command: s.grok.command || 'grok',
        cursorCommand: s.grok.cursorCommand || 'cursor-agent',
        configured: !!s.grok.configured,
        surface: s.grok.surface === 'chat' ? 'chat' : 'tui',
      }
    }
    if (s.adapt) adaptBackup.value = s.adapt.backup !== false
    ElMessage.success(prefsToast('grokSaved'))
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    savingGrok.value = false
  }
}

async function saveNotify() {
  savingNotify.value = true
  try {
    await api.appSettings.update({ notifications: notifyPrefs.value })
    await loadNotificationPrefs(true)
    ElMessage.success(prefsToast('notifySaved'))
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    savingNotify.value = false
  }
}

async function loadDataDir() {
  if (!isDesktop.value) return
  try {
    dataDirInfo.value = await api.system.dataDir()
  } catch {
    dataDirInfo.value = null
  }
}

async function migrateData() {
  migratingData.value = true
  try {
    const r = await api.system.migrateDataDir()
    if (r.ok) {
      ElMessage.success(prefsToast('migrateOk'))
      await loadDataDir()
    } else ElMessage.warning(r.error || prefsToast('migrateFail'))
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    migratingData.value = false
  }
}

async function loadUsageStats() {
  usageLoading.value = true
  try {
    usageStats.value = await api.usageStats()
  } catch (e) {
    ElMessage.error(e.message || prefsToast('usageLoadFail'))
  } finally {
    usageLoading.value = false
  }
}

async function sendTestNotify() {
  const ok = await desktopNotify(prefsTestNotifyTitle(), {
    body: prefsTestNotifyBody(),
    id: 'test:notify',
  })
  if (ok) ElMessage.success(prefsToast('testNotifyOk'))
  else ElMessage.warning(prefsToast('testNotifyFail'))
}

async function onToggleStartupUpdate(val) {
  savingStartupUpdate.value = true
  try {
    await api.appSettings.update({ updateCheck: { startup: !!val } })
    ElMessage.success(prefsToast(val ? 'startupUpdateOn' : 'startupUpdateOff'))
  } catch (e) {
    startupUpdateCheck.value = !val
    ElMessage.error(e.message)
  } finally {
    savingStartupUpdate.value = false
  }
}

async function onPurge() {
  try {
    await ElMessageBox.confirm(prefsConfirm('purgeBody'), prefsConfirm('purgeTitle'), {
      type: 'warning',
      confirmButtonText: prefsConfirm('purgeConfirm'),
      cancelButtonText: prefsConfirmCancel(),
      confirmButtonClass: 'el-button--danger',
    })
  } catch {
    return
  }
  purging.value = true
  try {
    const r = await api.appSettings.purgeDemo()
    ElMessage.success(r.message || prefsToast('purgeOk'))
    await load()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    purging.value = false
  }
}

let resourcePoll = 0
function onResourcePageVisible() {
  if (document.visibilityState === 'visible') loadResources({ quiet: true })
}

let resetResourcePoll = null

onMounted(() => {
  load()
  void loadDataDir()
  window.__ACW_DESKTOP_API__?.getNotificationPlatform?.().then((p) => {
    if (p && typeof p === 'object') notifyPlatform.value = p
  }).catch(() => {})
  const pollMs = () => (typeof document !== 'undefined' && document.hidden ? 15_000 : 3000)
  const tickResources = () => loadResources({ quiet: true })
  resetResourcePoll = () => {
    window.clearInterval(resourcePoll)
    resourcePoll = window.setInterval(tickResources, pollMs())
  }
  resetResourcePoll()
  document.addEventListener('visibilitychange', resetResourcePoll)
  document.addEventListener('visibilitychange', onResourcePageVisible)
  window.addEventListener('focus', onResourcePageVisible)
})

onUnmounted(() => {
  window.clearInterval(resourcePoll)
  if (resetResourcePoll) document.removeEventListener('visibilitychange', resetResourcePoll)
  document.removeEventListener('visibilitychange', onResourcePageVisible)
  window.removeEventListener('focus', onResourcePageVisible)
})
</script>

<style scoped>
.usage-pre {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  background: var(--ecw-surface-2, #f4f4f5);
  padding: 10px;
  border-radius: 8px;
}

.prefs-page {
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
.prefs-card {
  padding: 18px 18px 16px;
  border-radius: 16px;
  border: 0.5px solid rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.72);
  margin-bottom: 14px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}
.prefs-card--danger {
  border-color: rgba(255, 59, 48, 0.18);
  background: rgba(255, 248, 247, 0.85);
}
.prefs-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.prefs-title {
  font-size: 14px;
  font-weight: 650;
  margin-bottom: 6px;
}
.prefs-hint {
  margin: 0 0 12px;
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
  line-height: 1.55;
}
.prefs-resolved {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--ecw-accent, #007aff);
}
.admin-form {
  margin-bottom: 8px;
}
.prefs-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.backup-export-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
  margin-top: 10px;
}

.be-card {
  display: flex;
  flex-direction: column;
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.7);
  border: 0.5px solid rgba(0, 0, 0, 0.07);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.be-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.be-card-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 6px;
  background: rgba(0, 122, 255, 0.1);
  color: var(--ecw-accent, #007aff);
}

.be-card-badge--export {
  background: rgba(103, 194, 58, 0.12);
  color: #529b2e;
}

.be-card-title {
  font-size: 14px;
  font-weight: 650;
  color: var(--ecw-text-1, #1d1d1f);
}

.be-card-desc {
  flex: 1;
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.be-card-desc code {
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 11px;
  padding: 1px 4px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.05);
}

.be-card-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.be-last-info {
  margin-top: 10px;
  font-size: 11.5px;
  color: var(--el-text-color-placeholder);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
