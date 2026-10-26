<template>
  <div>
    <div class="page-head">
      <div>
        <h2 class="page-title">{{ groupsT('title') }}</h2>
        <p class="page-desc">
          {{ groupsT('desc1') }}<strong>{{ groupsT('descStrong1') }}</strong
          >{{ groupsT('desc2') }}<strong>{{ groupsT('descStrong2') }}</strong
          >{{ groupsT('desc3') }}
        </p>
      </div>
      <div class="page-head-actions">
        <el-button @click="triggerImportTemplate">{{ groupsT('importBtn') }}</el-button>
        <el-dropdown trigger="click" @command="applyBuiltinTemplate">
          <el-button>{{ groupsT('fromBuiltin') }}</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="t in builtinTemplates" :key="t.id" :command="t.id">
                {{ t.title }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <input
          ref="importFileRef"
          type="file"
          accept=".json,.acw.json"
          class="hidden-file-input"
          :aria-label="groupsT('a11y.importFile')"
          @change="onImportFile"
        />
        <el-button type="primary" @click="openCreate()">{{ groupsT('createBtn') }}</el-button>
      </div>
    </div>

    <el-input
      v-model="searchQ"
      class="page-search"
      :placeholder="groupsT('searchPlaceholder')"
      clearable
      :prefix-icon="SearchIcon"
      :aria-label="groupsT('a11y.search')"
    />

    <el-table :data="filteredList" stripe :aria-label="groupsT('a11y.list')">
      <el-table-column prop="title" :label="groupsT('table.title')" />
      <el-table-column prop="work_folder" :label="groupsT('table.workFolder')" show-overflow-tooltip />
      <el-table-column :label="groupsT('table.steps')" width="90">
        <template #default="{ row }">{{ row.steps?.length || 0 }}</template>
      </el-table-column>
      <el-table-column :label="groupsT('table.actions')" width="380">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">{{ groupsT('actions.edit') }}</el-button>
          <el-button link type="primary" @click="openClone(row)">{{ groupsT('actions.clone') }}</el-button>
          <el-button link type="primary" @click="exportTemplate(row)">{{ groupsT('actions.export') }}</el-button>
          <el-button link type="success" @click="start(row)">{{ groupsT('actions.start') }}</el-button>
          <el-button link type="info" @click="view(row)">{{ groupsT('actions.view') }}</el-button>
          <el-button link type="danger" @click="remove(row)">{{ groupsT('actions.remove') }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-drawer v-model="drawer" :title="drawerTitle" size="520px" destroy-on-close append-to-body>
      <template v-if="!readonly">
        <el-form label-position="top">
          <el-form-item :label="groupsT('form.title')" required>
            <el-input v-model="form.title" />
          </el-form-item>
          <el-form-item :label="groupsT('form.workFolder')">
            <PathPicker
              v-model="form.workFolder"
              mode="folder"
              :placeholder="groupsT('form.workFolderPlaceholder')"
              :hint="groupsT('form.workFolderHint')"
            />
          </el-form-item>
          <el-form-item :label="groupsT('form.desc')">
            <el-input v-model="form.description" type="textarea" :rows="2" />
          </el-form-item>

          <!-- Furnace config: inherits global by default -->
          <div class="admin-block">
            <div class="admin-block-title">
              {{ groupsT('admin.title') }}
              <span class="admin-block-hint">{{ groupsT('admin.hint') }}</span>
            </div>
            <el-form-item :label="groupsT('admin.inherit')" class="admin-inherit-item">
              <el-switch v-model="form.adminInherit" />
              <span class="switch-hint">
                {{ groupsT('admin.inheritHint') }}
                <template v-if="globalAdminLabel">{{ groupsAdminInheritHintCurrent(globalAdminLabel) }}</template>
              </span>
            </el-form-item>
            <el-form-item v-if="!form.adminInherit" :label="groupsT('admin.member')">
              <el-select
                v-model="form.adminMemberId"
                clearable
                filterable
                :placeholder="groupsT('admin.memberPlaceholder')"
                style="width: 100%"
              >
                <el-option
                  v-for="m in members"
                  :key="m.id"
                  :label="m.display_name"
                  :value="m.id"
                />
              </el-select>
              <div class="field-hint">{{ groupsT('admin.memberHint') }}</div>
            </el-form-item>
          </div>

          <div style="display: flex; justify-content: space-between; margin-bottom: 8px">
            <strong>{{ groupsT('steps.title') }}</strong>
            <el-button size="small" @click="addStep">{{ groupsT('steps.add') }}</el-button>
            <el-button size="small" @click="showBatch = !showBatch">{{ groupsT('steps.batchToggle') }}</el-button>
          </div>
          <div v-if="showBatch" class="batch-add">
            <el-select
              v-model="batchMemberIds"
              multiple
              filterable
              :placeholder="groupsT('steps.batchPlaceholder')"
              style="flex: 1; min-width: 200px"
            >
              <el-option v-for="m in members" :key="m.id" :label="m.display_name" :value="m.id" />
            </el-select>
            <el-checkbox v-model="batchRefine" class="capture-check">{{ groupsT('steps.batchRefine') }}</el-checkbox>
            <el-button size="small" type="primary" @click="applyBatchMembers">{{ groupsT('steps.batchApply') }}</el-button>
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
              <el-input v-model="s.title" :placeholder="groupsT('steps.titlePlaceholder')" />
            </div>
            <div class="step-card-row step-card-tools">
              <el-select v-model="s.type" style="width: 150px">
                <el-option :label="groupsT('steps.typeMember')" value="member" />
                <el-option :label="groupsT('steps.typeHuman')" value="human" />
                <el-option :label="groupsT('steps.typeOffsite')" value="offsite" />
              </el-select>
              <el-select
                v-if="s.type === 'member'"
                v-model="s.memberId"
                :placeholder="groupsT('steps.memberPlaceholder')"
                style="width: 160px"
                @change="(id) => onStepMemberChange(s, id)"
              >
                <el-option
                  v-for="m in members"
                  :key="m.id"
                  :label="m.display_name"
                  :value="m.id"
                />
              </el-select>
              <el-tag v-if="s.type === 'human'" size="small" type="info" effect="plain" round>
                {{ groupsT('steps.humanTag') }}
              </el-tag>
              <el-tag v-else-if="s.type === 'offsite'" size="small" type="warning" effect="plain" round>
                {{ groupsT('steps.offsiteTag') }}
              </el-tag>
              <el-checkbox
                v-if="s.type === 'human'"
                v-model="s.captureParams"
                class="capture-check"
              >
                {{ groupsT('steps.captureParams') }}
              </el-checkbox>
              <el-tooltip :content="adaptHover" placement="top" :show-after="300">
                <el-checkbox v-model="s.adapt" class="capture-check">{{ groupsT('steps.adapt') }}</el-checkbox>
              </el-tooltip>
              <el-tooltip :content="groupsT('steps.refineTip')" placement="top" :show-after="300">
                <el-checkbox v-model="s.refine" class="capture-check">{{ groupsT('steps.refine') }}</el-checkbox>
              </el-tooltip>
              <el-button size="small" @click="move(i, -1)" :disabled="i === 0">{{ groupsT('steps.moveUp') }}</el-button>
              <el-button size="small" @click="move(i, 1)" :disabled="i === form.steps.length - 1">
                {{ groupsT('steps.moveDown') }}
              </el-button>
              <el-button size="small" type="danger" plain @click="form.steps.splice(i, 1)">
                {{ groupsT('steps.remove') }}
              </el-button>
            </div>
            <el-collapse v-if="s.type !== 'offsite'" class="flow-advanced">
              <el-collapse-item :title="groupsT('steps.flowCollapse')" name="flow">
                <div class="flow-block">
                  <div class="flow-label">
                    {{ groupsT('steps.flowLabel') }}
                    <span class="flow-hint">{{ groupsT('steps.flowHint') }}</span>
                  </div>
                  <el-checkbox-group v-model="s.flowKeys" class="flow-checks">
                    <el-checkbox value="admin">{{ groupsT('steps.flowAdmin') }}</el-checkbox>
                    <el-checkbox value="auto">{{ groupsT('steps.flowAuto') }}</el-checkbox>
                    <el-checkbox value="human">{{ groupsT('steps.flowHuman') }}</el-checkbox>
                  </el-checkbox-group>
                  <p class="flow-policy">
                    {{ groupsT('steps.flowPolicy') }}
                  </p>
                </div>
              </el-collapse-item>
            </el-collapse>
            <p v-else class="flow-policy">
              {{ groupsT('steps.offsitePolicy') }}
            </p>
          </div>
          <p class="flow-policy" style="margin-top: 4px">
            {{ groupsT('steps.footerPolicy') }}
          </p>
          <el-button type="primary" @click="save">
            {{ form._editId ? groupsT('form.save') : form._cloneFrom ? groupsT('form.saveClone') : groupsT('form.create') }}
          </el-button>
        </el-form>
      </template>
      <template v-else>
        <el-descriptions :column="1" border>
          <el-descriptions-item :label="groupsT('steps.viewLabels.title')">{{ viewRow.title }}</el-descriptions-item>
          <el-descriptions-item :label="groupsT('steps.viewLabels.workFolder')">{{ viewRow.work_folder || '—' }}</el-descriptions-item>
          <el-descriptions-item :label="groupsT('steps.viewLabels.admin')">
            {{ formatAdminView(viewRow) }}
          </el-descriptions-item>
          <el-descriptions-item :label="groupsT('steps.viewLabels.steps')">
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
                  s.type === 'human' ? groupsT('steps.typeHuman') : s.type === 'offsite' ? groupsT('steps.typeOffsite') : groupsT('steps.typeMember')
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
                {{ groupsT('steps.viewCaptureParams') }}
              </el-tag>
              <el-tag
                v-if="s.adapt"
                size="small"
                effect="plain"
                round
                type="warning"
                class="view-step-tag"
              >
                {{ groupsT('steps.viewAdapt') }}
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
          <el-button type="primary" @click="openEdit(viewRow)">{{ groupsT('actions.edit') }}</el-button>
          <el-button @click="openClone(viewRow)">{{ groupsT('actions.clone') }}</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ElMessage from 'element-plus/es/components/message/index.mjs'
import ElMessageBox from 'element-plus/es/components/message-box/index.mjs'
import { Search } from '@element-plus/icons-vue'
import { api } from '../../api'
import PathPicker from '../../components/PathPicker.vue'
import { ADAPT_OPTION_HOVER, isFurnaceMember } from '@acw/shared'
import { fuzzySearch } from '@acw/shared'
import {
  groupsT,
  groupsToast,
  groupsConfirm,
  groupsCloneName,
  groupsRemoveConfirmBody,
  groupsStartTitle,
  groupsBatchAdded,
  groupsAdminInherit,
  groupsAdminInheritNamed,
  groupsAdminNone,
  groupsAdminInheritHintCurrent,
  groupsFlowTags,
} from '../../composables/settingsGroupsCopy.js'

const adaptHover = ADAPT_OPTION_HOVER

const router = useRouter()
const list = ref([])
const searchQ = ref('')
const SearchIcon = Search
// 群模板模糊搜索（拼音/首字母/大小写/子序列），多字段取最优
const filteredList = computed(() => {
  const q = searchQ.value
  if (!q || !q.trim()) return list.value
  return fuzzySearch(list.value, q, (g) => [
    g.title,
    g.description,
    g.work_folder,
  ]).items.map((h) => h.item)
})
const members = ref([])
const appSettings = ref({ admin: null, resolvedAdmin: null })
const drawer = ref(false)
const drawerTitle = ref('')
const readonly = ref(false)
const showBatch = ref(false)
const batchMemberIds = ref([])
const batchRefine = ref(false)
const importFileRef = ref(null)
const builtinTemplates = ref([])

async function loadBuiltinTemplates() {
  try {
    const r = await api.templates.listBuiltin()
    builtinTemplates.value = r.templates || []
  } catch {
    builtinTemplates.value = []
  }
}

async function applyBuiltinTemplate(id) {
  try {
    await api.templates.applyBuiltin(id)
    ElMessage.success(groupsToast('builtinCreated'))
    await load()
  } catch (e) {
    ElMessage.error(e.message || groupsToast('createFail'))
  }
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

async function exportTemplate(row) {
  try {
    const pack = await api.groups.exportTemplate(row.id)
    const safe = String(row.title || 'group').replace(/[^\w\u4e00-\u9fff-]+/gu, '_')
    downloadJson(`${safe}.acw.json`, pack)
    ElMessage.success(groupsToast('exportOk'))
  } catch (e) {
    ElMessage.error(e.message || groupsToast('exportFail'))
  }
}

function triggerImportTemplate() {
  importFileRef.value?.click()
}

async function onImportFile(ev) {
  const file = ev.target?.files?.[0]
  ev.target.value = ''
  if (!file) return
  try {
    const text = await file.text()
    const pack = JSON.parse(text)
    let vars = null
    try {
      const { value } = await ElMessageBox.prompt(
        groupsT('importPrompt'),
        groupsT('importPromptTitle'),
        { inputPlaceholder: groupsT('importPromptPlaceholder') },
      )
      if (value && String(value).trim()) vars = { workspace: String(value).trim() }
    } catch {
      return
    }
    await api.templates.import(pack, { onConflict: 'rename', vars })
    await load()
    ElMessage.success(groupsToast('importOk'))
  } catch (e) {
    ElMessage.error(e.message || groupsToast('importFail'))
  }
}

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
    title: s.title || groupsT('steps.defaultTitle'),
    type: s.type || 'member',
    memberId: s.memberId || null,
    gate: !!(s.gate || flowKeys.includes('human') || flowKeys.includes('admin')),
    flowKeys,
    captureParams: !!captureParams,
    adapt: !!s.adapt,
    refine: !!s.refine,
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
    // First node: collect project info → #1 #2…; flow follows global by default
    steps: [
      stepForm(
        {
          title: groupsT('steps.defaultFirst'),
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
      ? groupsAdminInheritNamed(globalAdminLabel.value)
      : groupsAdminInherit()
  }
  if (!a.memberId) return groupsAdminNone()
  const m = members.value.find((x) => x.id === a.memberId)
  return m?.display_name || a.memberId
}

function flowTags(s) {
  return groupsFlowTags(flowToKeys(s.flow, s.gate))
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
    if (s.adapt) row.adapt = true
    if (s.refine) row.refine = true
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
  // Default second step: the furnace first, otherwise the first member
  const admin =
    members.value.find((x) => isFurnaceMember(x)) ||
    members.value.find((x) => x.name === 'unified_admin') ||
    members.value[0]
  if (admin) {
    form.value.steps.push(
      stepForm({
        title: groupsT('steps.defaultMember'),
        type: 'member',
        memberId: admin.id,
        flow,
      }),
    )
  }
  drawerTitle.value = groupsT('drawer.create')
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
  drawerTitle.value = groupsT('drawer.edit')
  drawer.value = true
}

function openClone(row) {
  readonly.value = false
  const adm = adminFromRow(row)
  form.value = {
    title: groupsCloneName(row.title),
    workFolder: row.work_folder || '',
    description: row.description || '',
    adminInherit: adm.adminInherit,
    adminMemberId: adm.adminMemberId,
    steps: (row.steps || []).map((s, i) => stepForm(s, i)),
    _cloneFrom: row.id,
  }
  drawerTitle.value = groupsT('drawer.clone')
  drawer.value = true
}

function view(row) {
  readonly.value = true
  viewRow.value = row
  drawerTitle.value = groupsT('drawer.view')
  drawer.value = true
}

function addStep() {
  const flow = globalDefaultFlow()
  const first = members.value[0]
  form.value.steps.push(
    stepForm({
      title: groupsT('steps.defaultTitle'),
      type: 'member',
      memberId: first?.id || null,
      flow,
      refine: !!first?.config?.refine?.enabled,
    }),
  )
}

function onStepMemberChange(step, memberId) {
  const mem = members.value.find((m) => m.id === memberId)
  if (mem?.config?.refine?.enabled) step.refine = true
}

// —— Batch bind members: multi-select members → one step each, refine per step ——
function applyBatchMembers() {
  const flow = globalDefaultFlow()
  const selected = batchMemberIds.value
  if (!selected.length) {
    ElMessage.warning(groupsToast('batchPickFirst'))
    return
  }
  for (const id of selected) {
    const mem = members.value.find((m) => m.id === id)
    form.value.steps.push(
      stepForm({
        title: mem?.display_name || groupsT('steps.defaultTitle'),
        type: 'member',
        memberId: id,
        flow,
        refine: batchRefine.value || !!mem?.config?.refine?.enabled,
      }),
    )
  }
  batchMemberIds.value = []
  batchRefine.value = false
  showBatch.value = false
  ElMessage.success(groupsBatchAdded(selected.length))
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
      ElMessage.warning(groupsToast('saveWarnTitle'))
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
    ElMessage.success(groupsToast('saved'))
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function remove(row) {
  await ElMessageBox.confirm(groupsRemoveConfirmBody(row.title), groupsConfirm('removeTitle'), {
    type: 'warning',
  })
  try {
    await api.groups.remove(row.id)
    await load()
    ElMessage.success(groupsToast('removed'))
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function start(row) {
  try {
    const { value: mode } = await ElMessageBox.confirm(
      groupsConfirm('startBody'),
      groupsStartTitle(row.title),
      {
        distinguishCancelAndClose: true,
        confirmButtonText: groupsConfirm('startLive'),
        cancelButtonText: groupsConfirm('startDry'),
        type: 'info',
      },
    )
      .then(() => ({ value: 'live' }))
      .catch((action) => {
        if (action === 'cancel') return { value: 'dry' }
        throw Object.assign(new Error(groupsToast('startCancelled')), { silent: true })
      })
    const s = await api.groups.startSession(row.id, {
      dryRun: mode === 'dry',
    })
    ElMessage.success(mode === 'dry' ? groupsToast('startedDry') : groupsToast('startedLive'))
    router.push(`/workbench/${s.id}`)
  } catch (e) {
    if (!e.silent) ElMessage.error(e.message)
  }
}

onMounted(() => {
  load()
  loadBuiltinTemplates()
})
</script>

<style scoped>
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  gap: 16px;
}
.page-search {
  max-width: 420px;
  margin-bottom: 16px;
}
.batch-add {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
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

.flow-advanced {
  margin-top: 8px;
}
.flow-advanced :deep(.el-collapse-item__header) {
  font-size: 13px;
  font-weight: 650;
  height: 36px;
  line-height: 36px;
}
.flow-advanced :deep(.el-collapse-item__content) {
  padding-bottom: 4px;
}
.flow-advanced .flow-block {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
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

.page-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hidden-file-input {
  display: none;
}
</style>
