<template>
  <div>
    <div class="page-head">
      <div>
        <h2 class="page-title">群聊模板</h2>
        <p class="page-desc">线性步骤编排。支持<strong>编辑</strong>与<strong>克隆</strong>。</p>
      </div>
      <el-button type="primary" @click="openCreate()">新建群模板</el-button>
    </div>

    <el-table :data="list" stripe>
      <el-table-column prop="title" label="名称" />
      <el-table-column prop="work_folder" label="工作文件夹" show-overflow-tooltip />
      <el-table-column label="步骤数" width="90">
        <template #default="{ row }">{{ row.steps?.length || 0 }}</template>
      </el-table-column>
      <el-table-column label="操作" width="320">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="primary" @click="openClone(row)">克隆</el-button>
          <el-button link type="success" @click="start(row)">开聊</el-button>
          <el-button link type="info" @click="view(row)">查看</el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-drawer v-model="drawer" :title="drawerTitle" size="520px" destroy-on-close>
      <template v-if="!readonly">
        <el-form label-position="top">
          <el-form-item label="群名称" required>
            <el-input v-model="form.title" />
          </el-form-item>
          <el-form-item label="工作文件夹（可选）">
            <PathPicker
              v-model="form.workFolder"
              mode="folder"
              placeholder="会话默认工作目录"
              hint="可手填，或点「浏览」在本机选择文件夹"
            />
          </el-form-item>
          <el-form-item label="简介">
            <el-input v-model="form.description" type="textarea" :rows="2" />
          </el-form-item>

          <!-- 管理员配置：默认继承全局，可改、可不填 -->
          <div class="admin-block">
            <div class="admin-block-title">
              管理员配置
              <span class="admin-block-hint">可选 · 默认继承全局</span>
            </div>
            <el-form-item label="继承全局管理员" class="admin-inherit-item">
              <el-switch v-model="form.adminInherit" />
              <span class="switch-hint">
                开启后使用「设置 → 全局管理员」
                <template v-if="globalAdminLabel">（当前：{{ globalAdminLabel }}）</template>
              </span>
            </el-form-item>
            <el-form-item v-if="!form.adminInherit" label="本群管理员">
              <el-select
                v-model="form.adminMemberId"
                clearable
                filterable
                placeholder="可不选 · 留空表示本群不指定管理员"
                style="width: 100%"
              >
                <el-option
                  v-for="m in members"
                  :key="m.id"
                  :label="m.display_name"
                  :value="m.id"
                />
              </el-select>
              <div class="field-hint">不填则本群无专属管理员，仅使用步骤上的流转勾选。</div>
            </el-form-item>
          </div>

          <div style="display: flex; justify-content: space-between; margin-bottom: 8px">
            <strong>流程步骤</strong>
            <el-button size="small" @click="addStep">+ 添加步骤</el-button>
          </div>
          <div
            v-for="(s, i) in form.steps"
            :key="i"
            class="step-card"
            :class="{
              'step-card--human': s.type === 'human',
              'step-card--gate': s.gate,
              'step-card--offsite': s.type === 'offsite',
            }"
          >
            <div class="step-card-row">
              <span class="step-idx">{{ i + 1 }}.</span>
              <el-input v-model="s.title" placeholder="步骤标题" />
            </div>
            <div class="step-card-row step-card-tools">
              <el-select v-model="s.type" style="width: 150px">
                <el-option label="成员" value="member" />
                <el-option label="人工" value="human" />
                <el-option label="场外协助" value="offsite" />
              </el-select>
              <el-select
                v-if="s.type === 'member'"
                v-model="s.memberId"
                placeholder="绑定成员"
                style="width: 160px"
              >
                <el-option
                  v-for="m in members"
                  :key="m.id"
                  :label="m.display_name"
                  :value="m.id"
                />
              </el-select>
              <el-tag v-if="s.type === 'human'" size="small" type="info" effect="plain" round>
                人工步骤
              </el-tag>
              <el-tag v-else-if="s.type === 'offsite'" size="small" type="warning" effect="plain" round>
                额外
              </el-tag>
              <el-checkbox
                v-if="s.type === 'human'"
                v-model="s.captureParams"
                class="capture-check"
              >
                项目参数 #1 #2…
              </el-checkbox>
              <el-button size="small" @click="move(i, -1)" :disabled="i === 0">上移</el-button>
              <el-button size="small" @click="move(i, 1)" :disabled="i === form.steps.length - 1">
                下移
              </el-button>
              <el-button size="small" type="danger" plain @click="form.steps.splice(i, 1)">
                删
              </el-button>
            </div>
            <div class="flow-block" v-if="s.type !== 'offsite'">
              <div class="flow-label">
                节点流转
                <span class="flow-hint">可多选 · 默认全开</span>
              </div>
              <el-checkbox-group v-model="s.flowKeys" class="flow-checks">
                <el-checkbox value="admin">管理员总结与流转</el-checkbox>
                <el-checkbox value="auto">子节点产出自动流转</el-checkbox>
                <el-checkbox value="human">人工流转</el-checkbox>
              </el-checkbox-group>
              <p class="flow-policy">
                规则：明确拒绝=不通过；「人工流转」须人工同意；「管理员总结与流转」会汇总 # 参数与节点 I/O 到群报告；否则自动产出一票可通过。
              </p>
            </div>
            <p v-else class="flow-policy">
              额外节点可插任意位置，并随 @ 流动扩展。场外无「重新开始」；回主线/重开一律「克隆并从此开始」（本会话追加节点）。归档只释资源、可无限次，再发仍在本会话、不会新开群聊。未配置则开聊末尾自动补一个。
            </p>
          </div>
          <p class="flow-policy" style="margin-top: 4px">
            场外协助按步骤内联、琥珀色高亮。宗旨见「关于」：节点是死的，人是活的。
          </p>
          <el-button type="primary" @click="save">
            {{ form._editId ? '保存修改' : form._cloneFrom ? '克隆保存' : '创建' }}
          </el-button>
        </el-form>
      </template>
      <template v-else>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="名称">{{ viewRow.title }}</el-descriptions-item>
          <el-descriptions-item label="工作文件夹">{{ viewRow.work_folder || '—' }}</el-descriptions-item>
          <el-descriptions-item label="管理员">
            {{ formatAdminView(viewRow) }}
          </el-descriptions-item>
          <el-descriptions-item label="步骤">
            <div v-for="(s, i) in viewRow.steps" :key="i" class="view-step">
              <span class="view-step-idx">{{ i + 1 }}.</span>
              <span>{{ s.title }}</span>
              <el-tag
                size="small"
                effect="plain"
                round
                :type="s.type === 'human' ? 'info' : s.type === 'offsite' ? 'warning' : ''"
                class="view-step-tag"
              >
                {{
                  s.type === 'human' ? '人工' : s.type === 'offsite' ? '场外协助' : '成员'
                }}
              </el-tag>
              <el-tag
                v-if="s.type === 'human' && s.captureParams"
                size="small"
                effect="plain"
                round
                type="success"
                class="view-step-tag"
              >
                项目参数
              </el-tag>
              <el-tag
                v-for="t in flowTags(s)"
                :key="t"
                size="small"
                effect="plain"
                round
                type="info"
                class="view-step-tag"
              >
                {{ t }}
              </el-tag>
            </div>
          </el-descriptions-item>
        </el-descriptions>
        <div class="view-actions">
          <el-button type="primary" @click="openEdit(viewRow)">编辑</el-button>
          <el-button @click="openClone(viewRow)">克隆</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../../api'
import PathPicker from '../../components/PathPicker.vue'

const router = useRouter()
const list = ref([])
const members = ref([])
const appSettings = ref({ admin: null, resolvedAdmin: null })
const drawer = ref(false)
const drawerTitle = ref('')
const readonly = ref(false)

const globalAdminLabel = computed(() => {
  const r = appSettings.value?.resolvedAdmin
  if (r?.display_name) return r.display_name
  const a = appSettings.value?.admin
  if (a?.memberId) {
    const m = members.value.find((x) => x.id === a.memberId)
    return m?.display_name || a.memberId
  }
  return a?.memberKey || ''
})

function globalDefaultFlow() {
  const f = appSettings.value?.admin?.defaultFlow
  if (f && typeof f === 'object') {
    return {
      admin: f.admin !== false,
      auto: f.auto !== false,
      human: f.human !== false,
    }
  }
  return { admin: true, auto: true, human: true }
}
const viewRow = ref(null)
const form = ref(emptyForm())

function defaultFlowKeys() {
  return ['admin', 'auto', 'human']
}

function flowToKeys(flow, gate) {
  if (flow && typeof flow === 'object') {
    const keys = []
    if (flow.admin) keys.push('admin')
    if (flow.auto) keys.push('auto')
    if (flow.human) keys.push('human')
    if (keys.length) return keys
  }
  // 兼容旧 gate
  if (gate) return defaultFlowKeys()
  return ['auto']
}

function keysToFlow(keys) {
  const set = new Set(keys || [])
  return {
    admin: set.has('admin'),
    auto: set.has('auto'),
    human: set.has('human'),
  }
}

function stepForm(s = {}, index = 0) {
  const flowKeys = flowToKeys(s.flow, s.gate)
  // 人工步：显式配置优先；新建默认首步开启项目参数采集
  const captureParams =
    s.captureParams === true
      ? true
      : s.captureParams === false
        ? false
        : s.type === 'human' && index === 0
  return {
    id: s.id,
    title: s.title || '新步骤',
    type: s.type || 'member',
    memberId: s.memberId || null,
    gate: !!(s.gate || flowKeys.includes('human') || flowKeys.includes('admin')),
    flowKeys,
    captureParams: !!captureParams,
  }
}

function emptyForm() {
  const flow = globalDefaultFlow()
  return {
    title: '',
    workFolder: '',
    description: '',
    adminInherit: true,
    adminMemberId: null,
    // 第一个节点：采集项目信息 → #1 #2…；流转默认跟全局
    steps: [
      stepForm(
        {
          title: '输入项目信息（空格或换行分隔 → #1 #2…）',
          type: 'human',
          captureParams: true,
          flow,
        },
        0,
      ),
    ],
  }
}

function adminFromRow(row) {
  const a = row?.config?.admin
  if (!a || a.inherit !== false) {
    return { adminInherit: true, adminMemberId: null }
  }
  return {
    adminInherit: false,
    adminMemberId: a.memberId || null,
  }
}

function formatAdminView(row) {
  const a = row?.config?.admin
  if (!a || a.inherit !== false) {
    return globalAdminLabel.value
      ? `继承全局（${globalAdminLabel.value}）`
      : '继承全局'
  }
  if (!a.memberId) return '本群未指定（空）'
  const m = members.value.find((x) => x.id === a.memberId)
  return m?.display_name || a.memberId
}

function flowTags(s) {
  const keys = flowToKeys(s.flow, s.gate)
  const map = { admin: '管理员总结与流转', auto: '自动流转', human: '人工流转' }
  return keys.map((k) => map[k]).filter(Boolean)
}

function serializeSteps(steps) {
  return (steps || []).map((s, i) => {
    const flow = keysToFlow(s.flowKeys)
    const row = {
      id: s.id || `step_${i}`,
      title: s.title,
      type: s.type,
      memberId: s.memberId,
      flow,
      gate: !!(flow.human || flow.admin),
    }
    if (s.type === 'human') {
      row.captureParams = !!s.captureParams
    }
    return row
  })
}

async function load() {
  const [g, m, s] = await Promise.all([
    api.groups.list(),
    api.members.list(),
    api.appSettings.get().catch(() => ({})),
  ])
  list.value = g
  members.value = m
  appSettings.value = s || {}
}

function openCreate() {
  readonly.value = false
  form.value = emptyForm()
  const flow = globalDefaultFlow()
  // 默认第二步：优先统一管理员，否则第一个成员
  const admin =
    members.value.find((x) => x.name === 'unified_admin') ||
    members.value.find((x) => String(x.display_name || '').includes('管理员')) ||
    members.value[0]
  if (admin) {
    form.value.steps.push(
      stepForm({
        title: '执行成员',
        type: 'member',
        memberId: admin.id,
        flow,
      }),
    )
  }
  drawerTitle.value = '新建群模板'
  drawer.value = true
}

function openEdit(row) {
  readonly.value = false
  const adm = adminFromRow(row)
  form.value = {
    title: row.title,
    workFolder: row.work_folder || '',
    description: row.description || '',
    adminInherit: adm.adminInherit,
    adminMemberId: adm.adminMemberId,
    steps: (row.steps || []).map((s, i) => stepForm(s, i)),
    _editId: row.id,
  }
  drawerTitle.value = '编辑群模板'
  drawer.value = true
}

function openClone(row) {
  readonly.value = false
  const adm = adminFromRow(row)
  form.value = {
    title: `${row.title} 副本`,
    workFolder: row.work_folder || '',
    description: row.description || '',
    adminInherit: adm.adminInherit,
    adminMemberId: adm.adminMemberId,
    steps: (row.steps || []).map((s, i) => stepForm(s, i)),
    _cloneFrom: row.id,
  }
  drawerTitle.value = '克隆群模板'
  drawer.value = true
}

function view(row) {
  readonly.value = true
  viewRow.value = row
  drawerTitle.value = '查看群模板'
  drawer.value = true
}

function addStep() {
  const flow = globalDefaultFlow()
  form.value.steps.push(
    stepForm({
      title: '新步骤',
      type: 'member',
      memberId: members.value[0]?.id || null,
      flow,
    }),
  )
}

function move(i, d) {
  const j = i + d
  const arr = form.value.steps
  if (j < 0 || j >= arr.length) return
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
}

async function save() {
  try {
    if (!form.value.title?.trim()) {
      ElMessage.warning('请填写群名称')
      return
    }
    const body = {
      title: form.value.title.trim(),
      workFolder: form.value.workFolder || null,
      description: form.value.description,
      steps: serializeSteps(form.value.steps),
      admin: form.value.adminInherit
        ? { inherit: true, memberId: null, defaultFlow: null }
        : {
            inherit: false,
            memberId: form.value.adminMemberId || null,
            defaultFlow: null,
          },
    }
    if (form.value._editId) {
      await api.groups.update(form.value._editId, body)
    } else if (form.value._cloneFrom) {
      await api.groups.clone(form.value._cloneFrom, body)
    } else {
      await api.groups.create(body)
    }
    drawer.value = false
    await load()
    ElMessage.success('已保存')
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function remove(row) {
  await ElMessageBox.confirm(`删除群模板「${row.title}」？`, '删除', { type: 'warning' })
  try {
    await api.groups.remove(row.id)
    await load()
    ElMessage.success('已删除')
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function start(row) {
  try {
    const s = await api.groups.startSession(row.id, {})
    ElMessage.success('已开聊')
    router.push(`/workbench/${s.id}`)
  } catch (e) {
    ElMessage.error(e.message)
  }
}

onMounted(load)
</script>

<style scoped>
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  gap: 16px;
}
.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.page-desc {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin: 8px 0 0;
  line-height: 1.5;
}

/* 设置内：人工/闸门克制样式（灰边、不抢色） */
.step-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 10px;
  background: #fff;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.step-card--human,
.step-card--gate {
  border-color: var(--el-border-color);
  background: var(--el-fill-color-blank, #fafafa);
}

.step-card--offsite {
  border-color: rgba(196, 125, 26, 0.35);
  background: rgba(230, 162, 60, 0.06);
}

.step-card-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.step-card-row:last-child {
  margin-bottom: 0;
}

.step-card-tools {
  flex-wrap: wrap;
  align-items: center;
}

.capture-check {
  margin-right: 4px;
  font-size: 12px;
}

.admin-block {
  margin: 4px 0 18px;
  padding: 14px 14px 6px;
  border-radius: 14px;
  border: 0.5px solid rgba(0, 0, 0, 0.06);
  background: rgba(0, 0, 0, 0.02);
}

.admin-block-title {
  font-size: 13px;
  font-weight: 650;
  margin-bottom: 10px;
  color: var(--ecw-text-1, #1d1d1f);
}

.admin-block-hint {
  margin-left: 8px;
  font-size: 11.5px;
  font-weight: 400;
  color: var(--ecw-text-3, #86868b);
}

.admin-inherit-item :deep(.el-form-item__content) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.switch-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

.field-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.45;
}

.flow-block {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--el-border-color-lighter);
}

.flow-label {
  font-size: 12.5px;
  font-weight: 650;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
}

.flow-hint {
  margin-left: 8px;
  font-size: 11.5px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.flow-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
}

.flow-policy {
  margin: 8px 0 0;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.step-idx {
  flex-shrink: 0;
  width: 22px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  font-weight: 600;
}

.view-step {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 0;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.view-step-idx {
  color: var(--el-text-color-secondary);
  font-weight: 600;
  min-width: 1.5em;
}

.view-step-tag {
  font-weight: 500;
}
.view-actions {
  margin-top: 16px;
  display: flex;
  gap: 10px;
}
</style>
