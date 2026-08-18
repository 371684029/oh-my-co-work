<template>
  <div class="prefs-page">
    <div class="page-head">
      <div>
        <h2 class="page-title">设置</h2>
        <p class="page-desc">演示数据、全局熔炉与本地偏好（仅本机生效）</p>
      </div>
    </div>

    <section class="prefs-card">
      <div class="prefs-row">
        <div class="prefs-text">
          <div class="prefs-title">显示演示示例</div>
          <p class="prefs-hint">
            关闭后，成员 / 群模板 / 会话列表中隐藏「示例回声」「示例命令」「演示流」等演示数据（不删除）。
          </p>
        </div>
        <el-switch
          v-model="showDemo"
          :loading="saving"
          inline-prompt
          active-text="显示"
          inactive-text="隐藏"
          @change="onToggleDemo"
        />
      </div>
    </section>

    <section class="prefs-card">
      <div class="prefs-row">
        <div class="prefs-text">
          <div class="prefs-title">是否展示脚本弹窗</div>
          <p class="prefs-hint">
            全局默认。开启后脚本执行可弹出<strong>脚本自身控制台</strong>（bat 黑窗）。
            不再弹出角落「释放资源」小窗。进程占用请到下方「释放资源」选择会话后结束。
            <strong>优先级</strong>：成员 / 快捷指令 &gt; 全局。
          </p>
        </div>
        <el-switch
          v-model="showScriptPopup"
          :loading="savingPopup"
          inline-prompt
          active-text="是"
          inactive-text="否"
          @change="onToggleScriptPopup"
        />
      </div>
    </section>

    <section class="prefs-card">
      <div class="prefs-title">释放资源</div>
      <p class="prefs-hint">
        流程走完<strong>不再自动归档</strong>，常驻终端会一直占着。
        在此选择会话结束进程 / 内嵌终端，或一次性全部释放。
      </p>
      <el-form label-position="top" class="admin-form">
        <el-form-item label="占用中的会话">
          <el-select
            v-model="selectedSessionIds"
            multiple
            filterable
            clearable
            collapse-tags
            collapse-tags-tooltip
            placeholder="选择要释放的会话"
            style="width: 100%"
          >
            <el-option
              v-for="item in occupied"
              :key="item.sessionId"
              :label="resourceLabel(item)"
              :value="item.sessionId"
            />
          </el-select>
          <p v-if="!occupied.length" class="prefs-resolved">当前没有占用中的会话</p>
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
          释放选中
        </el-button>
        <el-button
          type="danger"
          plain
          size="small"
          :disabled="!occupied.length"
          :loading="releasing"
          @click="releaseAll"
        >
          全部释放资源
        </el-button>
        <el-button size="small" text :loading="loadingResources" @click="loadResources">
          刷新列表
        </el-button>
      </div>
    </section>

    <section class="prefs-card">
      <div class="prefs-title">熔炉（默认）</div>
      <p class="prefs-hint">
        新建群模板默认<strong>继承</strong>此处配置；群内可改为指定成员或留空。可不选。闸门通道内部字段仍为 admin。
      </p>
      <el-form label-position="top" class="admin-form">
        <el-form-item label="默认熔炉成员">
          <el-select
            v-model="adminMemberId"
            clearable
            filterable
            placeholder="可不选 · 默认匹配「熔炉」"
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
          <p v-if="resolvedHint" class="prefs-resolved">当前解析：{{ resolvedHint }}</p>
        </el-form-item>
        <el-form-item label="新建步骤默认流转">
          <el-checkbox-group v-model="defaultFlowKeys" @change="onAdminChange">
            <el-checkbox value="admin">熔炉总结与流转</el-checkbox>
            <el-checkbox value="auto">自动流转</el-checkbox>
            <el-checkbox value="human">人工流转</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <el-button type="primary" plain size="small" :loading="savingAdmin" @click="saveAdmin">
        保存熔炉配置
      </el-button>
    </section>

    <section class="prefs-card">
      <div class="prefs-title">Grok Build</div>
      <p class="prefs-hint">
        熔炉先跑本机 Grok TUI。未安装、未登录或未写好 <code>config.toml</code> 时，点精灵会打开教程。
        完整步骤见
        <router-link to="/settings/grok">Grok Build 教程</router-link>。
      </p>
      <el-form label-position="top" class="admin-form">
        <el-form-item label="已配置 Grok">
          <el-switch v-model="grok.configured" />
        </el-form-item>
        <el-form-item label="启动命令">
          <el-input v-model="grok.command" placeholder="grok" />
        </el-form-item>
        <el-form-item label="改源文件前打压缩包备份">
          <el-switch v-model="adaptBackup" />
          <p class="prefs-resolved">
            默认开。只备份即将改动的脚本，写到 data/backups/adapt。改失败则不改文件，只打步骤标记。
          </p>
        </el-form-item>
      </el-form>
      <el-button type="primary" plain size="small" :loading="savingGrok" @click="saveGrok">
        保存 Grok 配置
      </el-button>
    </section>

    <section class="prefs-card">
      <div class="prefs-title">终端偏好</div>
      <p class="prefs-hint">作用于内嵌 TUI：主题、字号、粘贴确认、退出后是否自动回到对话。</p>
      <el-form label-position="top" class="admin-form">
        <el-form-item label="主题">
          <el-select v-model="terminal.theme" style="width: 100%">
            <el-option label="项目深色" value="project-dark" />
            <el-option label="终端原色" value="native" />
            <el-option label="高对比度" value="high-contrast" />
          </el-select>
        </el-form-item>
        <el-form-item label="字号">
          <el-input-number v-model="terminal.fontSize" :min="10" :max="22" />
        </el-form-item>
        <el-form-item label="光标闪烁">
          <el-switch v-model="terminal.cursorBlink" />
        </el-form-item>
        <el-form-item label="多行粘贴">
          <el-select v-model="terminal.pastePolicy" style="width: 100%">
            <el-option label="超过一行需确认" value="confirm" />
            <el-option label="直接粘贴" value="allow" />
          </el-select>
        </el-form-item>
        <el-form-item label="进程结束后收起工作区">
          <el-switch v-model="terminal.autoCollapseOnExit" />
        </el-form-item>
      </el-form>
      <el-button type="primary" plain size="small" :loading="savingTerminal" @click="saveTerminal">
        保存终端偏好
      </el-button>
    </section>

    <section class="prefs-card">
      <div class="prefs-title">配额与脱敏</div>
      <p class="prefs-hint">
        限制单会话并发终端、日志大小与回放缓冲。日志会把常见 Token 打成 [REDACTED]，也可自写正则（每行一条）。
      </p>
      <el-form label-position="top" class="admin-form">
        <el-form-item label="单会话并发终端">
          <el-input-number v-model="quota.maxConcurrentTerminals" :min="1" :max="32" />
        </el-form-item>
        <el-form-item label="单终端日志上限（MiB）">
          <el-input-number v-model="quota.maxLogMiB" :min="1" :max="200" />
        </el-form-item>
        <el-form-item label="回放缓冲（KiB）">
          <el-input-number v-model="quota.maxReplayKiB" :min="32" :max="2048" />
        </el-form-item>
        <el-form-item label="日志脱敏">
          <el-switch v-model="redact.enabled" />
        </el-form-item>
        <el-form-item label="额外脱敏正则">
          <el-input
            v-model="redact.patternsText"
            type="textarea"
            :rows="3"
            placeholder="每行一条正则，例如 AKIA[0-9A-Z]{16}"
          />
        </el-form-item>
      </el-form>
      <el-button type="primary" plain size="small" :loading="savingQuota" @click="saveQuota">
        保存配额与脱敏
      </el-button>
    </section>

    <section class="prefs-card">
      <div class="prefs-title">本机备份</div>
      <p class="prefs-hint">把 SQLite、台账、附件打成 zip，写到 data/backups。不含运行中的 PTY 进程。</p>
      <el-button type="primary" plain size="small" :loading="backingUp" @click="onBackup">
        立即备份
      </el-button>
    </section>

    <section class="prefs-card prefs-card--danger">
      <div class="prefs-title">删除演示数据</div>
      <p class="prefs-hint">
        一键清除演示成员、演示群模板及其全部会话与消息，并结束相关进程。
        <strong>不可还原</strong>。不会删除「熔炉」与你自建的数据。
      </p>
      <el-button type="danger" plain :loading="purging" @click="onPurge">
        一键删除演示数据
      </el-button>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../../api'
import { setGrokConfigured } from '../../composables/furnaceUi.js'

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
  cursorBlink: true,
  pastePolicy: 'confirm',
  autoCollapseOnExit: false,
})
const quota = ref({
  maxConcurrentTerminals: 8,
  maxLogMiB: 10,
  maxReplayKiB: 256,
})
const redact = ref({ enabled: true, patternsText: '' })
const savingTerminal = ref(false)
const savingQuota = ref(false)
const backingUp = ref(false)
const grok = ref({ command: 'grok', configured: false })
const adaptBackup = ref(true)
const savingGrok = ref(false)

const resolvedHint = computed(() => {
  const r = resolvedAdmin.value
  if (r?.display_name) return r.display_name
  if (!adminMemberId.value) return '自动匹配「熔炉」（若存在）'
  return ''
})

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
    if (s.terminal) {
      terminal.value = {
        theme: s.terminal.theme || 'project-dark',
        fontSize: s.terminal.fontSize || 13,
        cursorBlink: s.terminal.cursorBlink !== false,
        pastePolicy: s.terminal.pastePolicy || 'confirm',
        autoCollapseOnExit: !!s.terminal.autoCollapseOnExit,
      }
    }
    if (s.grok) {
      grok.value = {
        command: s.grok.command || 'grok',
        configured: !!s.grok.configured,
      }
      setGrokConfigured(!!s.grok.configured)
    }
    adaptBackup.value = s.adapt?.backup !== false
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
  const bits = []
  if (item.processCount) bits.push(`${item.processCount} 进程`)
  if (item.terminalCount) bits.push(`${item.terminalCount} 终端`)
  return `${item.title}（${bits.join(' · ') || '占用'}）`
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
    ElMessage.warning('请先选中要释放的会话')
    return
  }
  releasing.value = true
  try {
    const r = await api.resources.release(selectedSessionIds.value)
    ElMessage.success(`已请求释放 ${r.released || selectedSessionIds.value.length} 个会话`)
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
    await ElMessageBox.confirm(
      '将结束当前所有占用会话的进程和内嵌终端。外部窗口若还在请手关。是否继续？',
      '全部释放资源',
      { type: 'warning', confirmButtonText: '全部释放', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  releasing.value = true
  try {
    const r = await api.resources.release([])
    ElMessage.success(`已请求释放 ${r.released || 0} 个会话`)
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
    ElMessage.success(showDemo.value ? '已显示演示示例' : '已隐藏演示示例')
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
    ElMessage.success(
      showScriptPopup.value ? '已开启：展示脚本弹窗' : '已关闭：不展示脚本弹窗',
    )
  } catch (e) {
    showScriptPopup.value = !val
    ElMessage.error(e.message)
  } finally {
    savingPopup.value = false
  }
}

async function saveTerminal() {
  savingTerminal.value = true
  try {
    await api.appSettings.update({ terminal: { ...terminal.value } })
    ElMessage.success('已保存终端偏好')
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
    ElMessage.success('已保存配额与脱敏')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    savingQuota.value = false
  }
}

async function onBackup() {
  backingUp.value = true
  try {
    const r = await api.backup()
    ElMessage.success(r.path ? `已备份到 ${r.path}` : r.message || '备份完成')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    backingUp.value = false
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
    ElMessage.success('已保存熔炉配置')
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
        configured: !!grok.value.configured,
      },
      adapt: { backup: adaptBackup.value !== false },
    })
    if (s.grok) {
      grok.value = {
        command: s.grok.command || 'grok',
        configured: !!s.grok.configured,
      }
    }
    setGrokConfigured(!!grok.value.configured)
    if (s.adapt) adaptBackup.value = s.adapt.backup !== false
    ElMessage.success('已保存 Grok 配置')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    savingGrok.value = false
  }
}

async function onPurge() {
  try {
    await ElMessageBox.confirm(
      '将永久删除演示成员、演示群模板及其全部会话。此操作不可还原。是否继续？',
      '删除演示数据',
      {
        type: 'warning',
        confirmButtonText: '确认删除（不可还原）',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger',
      },
    )
  } catch {
    return
  }
  purging.value = true
  try {
    const r = await api.appSettings.purgeDemo()
    ElMessage.success(r.message || '已删除演示数据')
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

onMounted(() => {
  load()
  resourcePoll = window.setInterval(() => loadResources({ quiet: true }), 3000)
  document.addEventListener('visibilitychange', onResourcePageVisible)
  window.addEventListener('focus', onResourcePageVisible)
})

onUnmounted(() => {
  window.clearInterval(resourcePoll)
  document.removeEventListener('visibilitychange', onResourcePageVisible)
  window.removeEventListener('focus', onResourcePageVisible)
})
</script>

<style scoped>
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
</style>
