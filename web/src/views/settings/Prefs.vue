<template>
  <div class="prefs-page">
    <div class="page-head">
      <div>
        <h2 class="page-title">设置</h2>
        <p class="page-desc">演示数据、全局管理员与本地偏好（仅本机生效）</p>
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
          <div class="prefs-title">工作台默认全屏</div>
          <p class="prefs-hint">
            默认开启。受浏览器安全限制，进入工作台后会在你的<strong>首次点击</strong>时进入全屏；
            也可随时使用右上角全屏按钮切换。
          </p>
        </div>
        <el-switch
          v-model="defaultFullscreen"
          :loading="savingFullscreen"
          inline-prompt
          active-text="开启"
          inactive-text="关闭"
          @change="onToggleFullscreen"
        />
      </div>
    </section>

    <section class="prefs-card">
      <div class="prefs-row">
        <div class="prefs-text">
          <div class="prefs-title">是否展示脚本弹窗</div>
          <p class="prefs-hint">
            全局默认。开启后脚本执行可弹出<strong>脚本自身控制台</strong>（bat 黑窗）。
            不再弹出角落「释放资源」小窗；归档/节点结束会自动杀进程。
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
      <div class="prefs-title">归档策略</div>
      <p class="prefs-hint">
        流程末尾固定「归档」：可手工归档或点「同意归档」；
        超时未确认则按下方小时数<strong>自动归档</strong>并释放进程。
        默认 <strong>3 小时</strong>一般够用，可按需自改。
      </p>
      <el-form label-position="top" class="admin-form">
        <el-form-item label="自动归档超时（小时）">
          <el-input-number
            v-model="autoArchiveHours"
            :min="0.1"
            :max="720"
            :step="1"
            :precision="1"
          />
          <span class="prefs-unit">小时（默认 3）</span>
        </el-form-item>
      </el-form>
      <el-button type="primary" plain size="small" :loading="savingArchive" @click="saveArchive">
        保存归档设置
      </el-button>
    </section>

    <section class="prefs-card">
      <div class="prefs-title">全局管理员（默认）</div>
      <p class="prefs-hint">
        新建群模板默认<strong>继承</strong>此处配置；群内可改为指定成员或留空。可不选。
      </p>
      <el-form label-position="top" class="admin-form">
        <el-form-item label="默认管理员成员">
          <el-select
            v-model="adminMemberId"
            clearable
            filterable
            placeholder="可不选 · 默认匹配「统一管理员」"
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
            <el-checkbox value="admin">管理员总结与流转</el-checkbox>
            <el-checkbox value="auto">自动流转</el-checkbox>
            <el-checkbox value="human">人工流转</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <el-button type="primary" plain size="small" :loading="savingAdmin" @click="saveAdmin">
        保存管理员配置
      </el-button>
    </section>

    <section class="prefs-card prefs-card--danger">
      <div class="prefs-title">删除演示数据</div>
      <p class="prefs-hint">
        一键清除演示成员、演示群模板及其全部会话与消息，并结束相关进程。
        <strong>不可还原</strong>。不会删除「统一管理员」与你自建的数据。
      </p>
      <el-button type="danger" plain :loading="purging" @click="onPurge">
        一键删除演示数据
      </el-button>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../../api'

const showDemo = ref(true)
const showScriptPopup = ref(true)
const defaultFullscreen = ref(true)
const saving = ref(false)
const savingPopup = ref(false)
const savingFullscreen = ref(false)
const savingAdmin = ref(false)
const savingArchive = ref(false)
const purging = ref(false)
const members = ref([])
const adminMemberId = ref(null)
const defaultFlowKeys = ref(['admin', 'auto', 'human'])
const resolvedAdmin = ref(null)
const autoArchiveHours = ref(3)

const resolvedHint = computed(() => {
  const r = resolvedAdmin.value
  if (r?.display_name) return r.display_name
  if (!adminMemberId.value) return '自动匹配「统一管理员」（若存在）'
  return ''
})

async function load() {
  try {
    const [s, m] = await Promise.all([api.appSettings.get(), api.members.list()])
    showDemo.value = s.showDemo !== false
    showScriptPopup.value = s.showScriptPopup !== false
    defaultFullscreen.value = s.defaultFullscreen !== false
    members.value = m || []
    resolvedAdmin.value = s.resolvedAdmin || null
    autoArchiveHours.value =
      s.autoArchiveHours != null ? Number(s.autoArchiveHours) : 3
    const a = s.admin || {}
    adminMemberId.value = a.memberId || s.resolvedAdmin?.id || null
    const f = a.defaultFlow || { admin: true, auto: true, human: true }
    const keys = []
    if (f.admin !== false) keys.push('admin')
    if (f.auto !== false) keys.push('auto')
    if (f.human !== false) keys.push('human')
    defaultFlowKeys.value = keys.length ? keys : ['auto']
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function saveArchive() {
  savingArchive.value = true
  try {
    const s = await api.appSettings.update({
      autoArchiveHours: autoArchiveHours.value,
    })
    autoArchiveHours.value = s.autoArchiveHours ?? 3
    ElMessage.success(`已保存：${autoArchiveHours.value} 小时未确认将自动归档`)
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    savingArchive.value = false
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

async function onToggleFullscreen(val) {
  savingFullscreen.value = true
  try {
    const s = await api.appSettings.update({ defaultFullscreen: !!val })
    defaultFullscreen.value = s.defaultFullscreen !== false
    ElMessage.success(defaultFullscreen.value ? '已开启工作台默认全屏' : '已关闭工作台默认全屏')
  } catch (e) {
    defaultFullscreen.value = !val
    ElMessage.error(e.message)
  } finally {
    savingFullscreen.value = false
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
    ElMessage.success('已保存全局管理员配置')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    savingAdmin.value = false
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

onMounted(load)
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
.prefs-unit {
  margin-left: 10px;
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
}
</style>
