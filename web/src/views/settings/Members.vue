<template>
  <div>
    <div class="page-head">
      <div>
        <h2 class="page-title">{{ membersT('title') }}</h2>
        <p class="page-desc">
          {{ membersT('desc1') }}<strong>{{ membersT('descStrong1') }}</strong
          >{{ membersT('desc2') }}<strong>{{ membersT('descStrong2') }}</strong
          >{{ membersT('desc3') }}<strong>{{ membersT('descStrong3') }}</strong
          >{{ membersT('desc4') }}
        </p>
      </div>
      <div class="page-head-actions">
        <el-button @click="triggerImportTemplate">{{ membersT('importBtn') }}</el-button>
        <input
          ref="importFileRef"
          type="file"
          accept=".json,.acw.json"
          class="hidden-file-input"
          :aria-label="membersT('a11y.importFile')"
          @change="onImportFile"
        />
        <el-button type="primary" @click="openCreate()">{{ membersT('createBtn') }}</el-button>
      </div>
    </div>

    <el-input
      v-model="searchQ"
      class="page-search"
      :placeholder="membersT('searchPlaceholder')"
      clearable
      :prefix-icon="SearchIcon"
      :aria-label="membersT('a11y.search')"
    />

    <el-table :data="filteredList" stripe :aria-label="membersT('a11y.list')">
      <el-table-column prop="display_name" :label="membersT('table.displayName')" min-width="120" />
      <el-table-column :label="membersT('table.desc')" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.config?.description || '—' }}
        </template>
      </el-table-column>
      <el-table-column prop="kind" :label="membersT('table.kind')" width="90" />
      <el-table-column :label="membersT('table.refine')" width="88">
        <template #default="{ row }">
          <el-tag v-if="row.config?.refine?.enabled" size="small" type="success" effect="plain">{{ membersT('table.refineOn') }}</el-tag>
          <span v-else class="muted-dash">—</span>
        </template>
      </el-table-column>
      <el-table-column :label="membersT('table.run')" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">
          {{ runSummary(row) }}
        </template>
      </el-table-column>
      <el-table-column :label="membersT('table.actions')" width="320">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">{{ membersT('actions.edit') }}</el-button>
          <el-button link type="primary" @click="openClone(row)">{{ membersT('actions.clone') }}</el-button>
          <el-button link type="primary" @click="exportTemplate(row)">{{ membersT('actions.export') }}</el-button>
          <el-button link type="info" @click="view(row)">{{ membersT('actions.view') }}</el-button>
          <el-button link type="danger" @click="remove(row)">{{ membersT('actions.remove') }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-drawer
      v-model="drawer"
      :title="drawerTitle"
      size="480px"
      destroy-on-close
      append-to-body
      class="member-settings-drawer"
    >
      <el-form v-if="!readonly" label-position="top">
        <el-form-item :label="membersT('form.displayName')" required>
          <el-input v-model="form.displayName" :placeholder="membersT('form.displayNamePlaceholder')" />
        </el-form-item>
        <el-form-item :label="membersT('form.desc')">
          <el-input
            v-model="form.description"
            :placeholder="membersT('form.descPlaceholder')"
            maxlength="120"
            show-word-limit
            clearable
          />
        </el-form-item>
        <el-form-item>
          <el-tooltip :content="adaptHover" placement="top" :show-after="300">
            <el-checkbox v-model="form.adapt">{{ membersT('form.adapt') }}</el-checkbox>
          </el-tooltip>
        </el-form-item>
        <el-form-item>
          <el-tooltip :content="membersT('form.refineTip')" placement="top" :show-after="300">
            <el-checkbox v-model="form.refine">{{ membersT('form.refine') }}</el-checkbox>
          </el-tooltip>
          <div class="field-hint">{{ membersT('form.refineHint') }}</div>
          <el-button
            v-if="form._editId"
            size="small"
            type="warning"
            plain
            class="refine-restore-btn"
            :loading="restoringRefine"
            @click="onRestoreRefine"
          >
            {{ membersT('form.refineRestore') }}
          </el-button>
        </el-form-item>
        <el-form-item v-if="form.refine" :label="membersT('form.refineSkills')">
          <div class="refine-skill-box">
            <el-input
              v-model="refineSkillPrompt"
              type="textarea"
              :rows="3"
              readonly
            />
            <el-button size="small" type="primary" plain @click="copyRefineSkillPrompt">
              {{ membersT('form.refineCopySkill') }}
            </el-button>
          </div>
          <div class="field-hint">
            {{ membersT('form.refineSkillHint1') }}<code>POST /api/docs/refine</code
            >{{ membersT('form.refineSkillHint2') }}
          </div>
        </el-form-item>


        <template v-if="form.kind === 'script'">
          <el-tabs v-model="scriptTab" class="member-script-tabs">
            <el-tab-pane :label="membersT('form.tabBasic')" name="basic">
              <el-form-item :label="membersT('form.mode')">
                <el-radio-group v-model="form.script.mode" @change="onScriptModeChange">
                  <el-radio value="file">{{ membersT('form.modeFile') }}</el-radio>
                  <el-radio value="command">{{ membersT('form.modeCommand') }}</el-radio>
                </el-radio-group>
              </el-form-item>

              <el-form-item v-if="form.script.mode === 'file'" :label="membersT('form.filePath')" required>
                <PathPicker
                  v-model="form.script.filePath"
                  mode="file"
                  :placeholder="membersT('form.filePathPlaceholder')"
                  :extensions="scriptExts"
                  :hint="membersT('form.filePathHint')"
                  @update:model-value="onScriptAnchorPathChange"
                />
              </el-form-item>

              <el-form-item v-else :label="membersT('form.command')" required>
                <el-input
                  v-model="form.script.command"
                  type="textarea"
                  :rows="3"
                  :placeholder="membersT('form.commandPlaceholder')"
                />
                <div class="field-hint">
                  <strong>{{ membersT('form.commandHintStrong') }}</strong
                  >{{ membersT('form.commandHint1') }}<code>#a</code> / <code>{#a}</code
                  >{{ membersT('form.commandHint2') }}{{ membersT('form.commandHintPlaceholders')
                  }}{{ membersT('form.commandHint3') }}
                </div>
              </el-form-item>

              <el-form-item :label="membersT('form.workDir')" required>
                <PathPicker
                  v-model="form.script.scriptWorkDir"
                  mode="folder"
                  :placeholder="membersT('form.workDirPlaceholder')"
                  :hint="workDirHint"
                />
              </el-form-item>

              <el-form-item :label="membersT('form.execMode')">
                <el-select v-model="form.script.executionMode" style="width: 100%">
                  <el-option :label="membersT('form.execTerminal')" value="terminal" />
                  <el-option :label="membersT('form.execPipe')" value="pipe" />
                </el-select>
                <div class="field-hint">
                  {{ membersT('form.execHintPrefix') }}<strong>{{ membersT('form.execHintStrong') }}</strong
                  >{{ membersT('form.execHintSuffix') }}
                </div>
              </el-form-item>

              <el-form-item v-if="form.script.executionMode === 'terminal'" :label="membersT('form.adapter')">
                <el-select v-model="form.script.adapter" style="width: 100%">
                  <el-option :label="membersT('form.adapterNone')" value="none" />
                  <el-option :label="membersT('form.adapterJsonl')" value="jsonl" />
                </el-select>
                <div class="field-hint">
                  {{ membersT('form.adapterHint1') }}<code>.acw-adapter.events.jsonl</code
                  >{{ membersT('form.adapterHint2') }}<code>ACW_ADAPTER_EVENTS</code> /
                  <code>ACW_ADAPTER_REPLY</code>{{ membersT('form.adapterHint3') }}
                </div>
              </el-form-item>

              <el-form-item v-if="form.script.executionMode !== 'terminal'" :label="membersT('form.popup')">
                <el-select v-model="form.script.showScriptPopupMode" style="width: 100%">
                  <el-option :label="membersT('form.popupInherit')" value="inherit" />
                  <el-option :label="membersT('form.popupYes')" value="yes" />
                  <el-option :label="membersT('form.popupNo')" value="no" />
                </el-select>
                <span class="switch-hint">{{ membersT('form.popupHint') }}</span>
              </el-form-item>
            </el-tab-pane>

            <el-tab-pane :label="membersT('form.tabAdvanced')" name="advanced">
              <el-form-item :label="membersT('form.runtime')">
                <el-select v-model="form.script.runtime" style="width: 100%" filterable allow-create>
                  <el-option label="cmd" value="cmd" />
                  <el-option :label="membersT('form.runtimeAuto')" value="auto" />
                  <el-option label="PowerShell" value="powershell" />
                  <el-option label="pwsh" value="pwsh" />
                  <el-option label="bash" value="bash" />
                  <el-option label="python" value="python" />
                  <el-option label="node" value="node" />
                </el-select>
                <div class="field-hint">
                  {{ membersT('form.runtimeHint1') }}
                  <template v-if="form.script.mode === 'file'">
                    {{ membersT('form.runtimeHintFile') }}
                  </template>
                  <template v-else>{{ membersT('form.runtimeHintCommand') }}</template>
                </div>
              </el-form-item>

              <el-form-item v-if="form.script.mode === 'file'" :label="membersT('form.args')">
                <el-input v-model="form.script.argsText" placeholder="--flag value" />
              </el-form-item>

              <el-form-item :label="membersT('form.env')">
                <el-input
                  v-model="form.script.envText"
                  type="textarea"
                  :rows="2"
                  :placeholder="membersT('form.envPlaceholder')"
                />
                <div class="field-hint">{{ membersT('form.envHint') }}</div>
              </el-form-item>

              <el-form-item :label="membersT('form.detach')">
                <el-switch v-model="form.script.detach" />
                <span class="switch-hint">
                  <template v-if="form.script.executionMode === 'terminal'">
                    {{ membersT('form.detachHintTerminal') }}
                  </template>
                  <template v-else>
                    {{ membersT('form.detachHintPipe') }}
                  </template>
                </span>
              </el-form-item>

              <el-form-item :label="membersT('form.stdin')">
                <el-switch v-model="form.script.useHumanAsStdin" />
              </el-form-item>
            </el-tab-pane>
          </el-tabs>
        </template>

        <el-button type="primary" @click="save">
          {{ form._editId ? membersT('form.save') : form._cloneFrom ? membersT('form.saveClone') : membersT('form.create') }}
        </el-button>
      </el-form>

      <div v-else>
        <el-descriptions :column="1" border>
          <el-descriptions-item :label="membersT('table.displayName')">{{ viewRow.display_name }}</el-descriptions-item>
          <el-descriptions-item :label="membersT('form.desc')">
            {{ viewRow.config?.description || '—' }}
          </el-descriptions-item>
          <el-descriptions-item :label="membersT('table.kind')">{{ viewRow.kind }}</el-descriptions-item>
          <el-descriptions-item :label="membersT('form.adapt')">
            {{ viewRow.config?.adapt ? membersT('form.yes') : membersT('form.no') }}
          </el-descriptions-item>
          <el-descriptions-item :label="membersT('form.viewConfig')">
            <pre class="cfg-pre">{{ JSON.stringify(viewRow.config, null, 2) }}</pre>
          </el-descriptions-item>
        </el-descriptions>
        <div class="view-actions">
          <el-button type="primary" @click="openEdit(viewRow)">{{ membersT('actions.edit') }}</el-button>
          <el-button @click="openClone(viewRow)">{{ membersT('actions.clone') }}</el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import ElMessage from 'element-plus/es/components/message/index.mjs'
import ElMessageBox from 'element-plus/es/components/message-box/index.mjs'
import { Search } from '@element-plus/icons-vue'
import { api } from '../../api'
import PathPicker from '../../components/PathPicker.vue'
import { ADAPT_OPTION_HOVER } from '@acw/shared'
import { fuzzySearch } from '@acw/shared'
import {
  membersT,
  membersToast,
  membersConfirm,
  membersConfirmCancel,
  membersCloneName,
  membersRefineSkillFallback,
  membersRefineSavedHint,
  membersRestoreOk,
  membersRemoveConfirmBody,
  membersRestoreConflictBody,
  membersPlanConfirmBody,
} from '../../composables/settingsMembersCopy.js'

const adaptHover = ADAPT_OPTION_HOVER

const scriptExts = [
  '.bat',
  '.cmd',
  '.ps1',
  '.sh',
  '.py',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.rb',
  '.php',
  '.vbs',
  '.jar',
  '.exe',
]

const list = ref([])
const searchQ = ref('')
const importFileRef = ref(null)
const SearchIcon = Search

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
    const pack = await api.members.exportTemplate(row.id)
    const safe = String(row.display_name || row.name || 'member').replace(/[^\w\u4e00-\u9fff-]+/gu, '_')
    downloadJson(`${safe}.acw.json`, pack)
    ElMessage.success(membersToast('exportOk'))
  } catch (e) {
    ElMessage.error(e.message || membersToast('exportFail'))
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
        membersT('importPrompt'),
        membersT('importPromptTitle'),
        { inputPlaceholder: membersT('importPromptPlaceholder') },
      )
      if (value && String(value).trim()) vars = { workspace: String(value).trim() }
    } catch {
      return
    }
    await api.templates.import(pack, { onConflict: 'rename', vars })
    await load()
    ElMessage.success(membersToast('importOk'))
  } catch (e) {
    ElMessage.error(e.message || membersToast('importFail'))
  }
}
// 成员模糊搜索（拼音/首字母/大小写/子序列），多字段取最优
const filteredList = computed(() => {
  const q = searchQ.value
  if (!q || !q.trim()) return list.value
  return fuzzySearch(list.value, q, (m) => [
    m.display_name,
    m.name,
    m.config?.description,
    m.config?.role,
    m.kind,
  ]).items.map((h) => h.item)
})
const drawer = ref(false)
const drawerTitle = ref('')
const readonly = ref(false)
const viewRow = ref(null)
const form = ref(emptyForm())
const refineSkillPrompt = ref(membersRefineSkillFallback())
const restoringRefine = ref(false)

async function refreshRefineSkillPrompt() {
  try {
    const r = await api.docs.refinePrompt()
    if (r?.prompt) refineSkillPrompt.value = r.prompt
  } catch {
    /* Keep the local fallback copy */
  }
}

async function onRestoreRefine() {
  const id = form.value._editId
  if (!id) return
  try {
    await ElMessageBox.confirm(
      membersConfirm('restoreBody'),
      membersConfirm('restoreTitle'),
      {
        type: 'warning',
        confirmButtonText: membersConfirm('restoreOk'),
        cancelButtonText: membersConfirmCancel(),
      },
    )
  } catch {
    return
  }
  restoringRefine.value = true
  try {
    let r
    try {
      r = await api.members.restoreRefine(id)
    } catch (e) {
      if (e?.code !== 'RESTORE_CONFLICT' && !String(e?.message || '').includes('炼化后有改动')) {
        throw e
      }
      const list = (e.conflicts || []).map((c) => c.path).join('\n')
      await ElMessageBox.confirm(
        membersRestoreConflictBody(list, e.message),
        membersConfirm('conflictTitle'),
        {
          type: 'warning',
          confirmButtonText: membersConfirm('forceOk'),
          cancelButtonText: membersConfirmCancel(),
        },
      )
      r = await api.members.restoreRefine(id, { force: true })
    }
    ElMessage.success(membersRestoreOk((r.restored || []).length))
    form.value.refine = false
    await load()
    if (viewRow.value?.id === id) {
      const row = list.value.find((m) => m.id === id)
      if (row) viewRow.value = row
    }
  } catch (e) {
    ElMessage.error(e?.message || membersToast('restoreFail'))
  } finally {
    restoringRefine.value = false
  }
}

async function copyRefineSkillPrompt() {
  await refreshRefineSkillPrompt()
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(refineSkillPrompt.value)
      ElMessage.success(membersToast('copySkillOk'))
      return
    }
  } catch {
    /* Non-secure context or permission denied */
  }
  ElMessage.info(refineSkillPrompt.value)
}
const scriptTab = ref('basic')
const installDir = ref('')

const workDirHint = computed(() => {
  if (form.value.script.scriptWorkDir === installDir.value && installDir.value) {
    return membersT('form.workDirHintPrefilled')
  }
  return membersT('form.workDirHintRequired')
})

function isWindowsClient() {
  return typeof navigator !== 'undefined' && /windows/i.test(navigator.userAgent)
}

function defaultRuntime() {
  return isWindowsClient() ? 'cmd' : 'auto'
}

function scriptKeepAlive(s = {}) {
  if (s.waitForExit === true || s.detach === false) return false
  if (s.detach === true || s.waitForExit === false) return true
  return s.executionMode !== 'pipe'
}

/** 切换运行方式时若尚未选解释器，按本机补默认值 */
function onScriptModeChange() {
  const s = form.value.script
  if (!s.runtime) s.runtime = defaultRuntime()
}

function emptyForm() {
  return {
    displayName: '',
    description: '',
    kind: 'script',
    adapt: false,
    refine: false,
    script: {
      mode: 'file',
      filePath: '',
      scriptWorkDir: '',
      scriptDir: '',
      command: 'echo ECW-OK',
      runtime: defaultRuntime(),
      argsText: '',
      envText: '',
      executionMode: 'terminal',
      adapter: 'none',
      /** inherit | yes | no */
      showScriptPopupMode: 'inherit',
      detach: true,
      useHumanAsStdin: false,
    },
  }
}

/** 解析 KEY=value 环境变量文本 */
function parseEnvText(text) {
  const env = {}
  if (!text || !String(text).trim()) return env
  for (const line of String(text).split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i <= 0) continue
    const k = t.slice(0, i).trim()
    const v = t.slice(i + 1).trim()
    if (k) env[k] = v
  }
  return env
}

function envTextFromObj(obj) {
  if (!obj || typeof obj !== 'object') return ''
  return Object.entries(obj)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
}

/** 成员 script → 表单三态 */
function popupModeFromScript(s = {}) {
  if (s.showScriptPopup === true || s.showConsole === true) return 'yes'
  if (s.showScriptPopup === false || s.hideWindow === true || s.showConsole === false) return 'no'
  return 'inherit'
}

/** 表单三态 → 写入 script 字段 */
function popupFieldsFromMode(mode) {
  if (mode === 'yes') return { showScriptPopup: true, showConsole: true, hideWindow: false }
  if (mode === 'no') return { showScriptPopup: false, showConsole: false, hideWindow: true }
  // inherit：不写死，删除强制项
  return {}
}

function runSummary(row) {
  if (row.kind !== 'script') return row.kind
  const s = row.config?.script || row.config || {}
  const prefix = s.executionMode === 'pipe' ? '' : 'TUI · '
  if (s.mode === 'file' || s.filePath) {
    const p = s.filePath || s.path || ''
    const base = p.split(/[/\\]/).pop() || p
    return `${prefix}file · ${base}${s.runtime && s.runtime !== 'auto' ? ` (${s.runtime})` : ''}`
  }
  const cmd = (s.command || '').slice(0, 40)
  return `${prefix}cmd · ${cmd}${(s.command || '').length > 40 ? '…' : ''}`
}

function parseArgs(text) {
  if (!text || !String(text).trim()) return []
  // 简单按空格拆，支持引号
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g
  const out = []
  let m
  while ((m = re.exec(text))) {
    out.push(m[1] ?? m[2] ?? m[3])
  }
  return out
}

function dirnameOfFilePath(p) {
  if (!p) return ''
  const norm = String(p).replace(/[/\\]+$/, '')
  const i = Math.max(norm.lastIndexOf('\\'), norm.lastIndexOf('/'))
  if (i <= 0) return norm
  if (/^[a-zA-Z]:$/.test(norm.slice(0, i))) return norm.slice(0, i + 1)
  return norm.slice(0, i) || norm
}

/** 浏览选脚本后写入 scriptWorkDir（文件路径） */
function onScriptAnchorPathChange(v) {
  const raw = (v ?? '').trim()
  if (!raw) {
    form.value.script.scriptWorkDir = ''
    form.value.script.scriptDir = ''
    return
  }
  if (/^[a-zA-Z]:[\\/]|^\\\\|^\//.test(raw)) {
    const d = dirnameOfFilePath(raw)
    form.value.script.scriptWorkDir = d
    form.value.script.scriptDir = d
  }
}

async function loadInstallDir() {
  try {
    const roots = await api.fs.roots()
    const cwd = roots.find((r) => r.type === 'cwd')
    if (cwd) {
      installDir.value = cwd.path
    }
  } catch (e) {
    // ignore
  }
}

async function load() {
  list.value = await api.members.list()
}

function fillFromRow(row, { asClone = false } = {}) {
  const s = row.config?.script || {}
  return {
    displayName: asClone ? membersCloneName(row.display_name) : row.display_name,
    description: row.config?.description || '',
    kind: row.kind,
    adapt: !!row.config?.adapt,
    refine: !!row.config?.refine?.enabled,
    script: {
      mode: s.mode || (s.filePath ? 'file' : 'command'),
      filePath: s.filePath || '',
      scriptWorkDir: s.scriptWorkDir || s.scriptDir || '',
      scriptDir: s.scriptWorkDir || s.scriptDir || '',
      command: s.command || 'echo ECW-OK',
      runtime: s.runtime || defaultRuntime(),
      argsText: Array.isArray(s.args) ? s.args.join(' ') : '',
      envText: envTextFromObj(s.env),
      executionMode: s.executionMode === 'pipe' ? 'pipe' : 'terminal',
      adapter: s.adapter === 'jsonl' || s.adapter?.type === 'jsonl' ? 'jsonl' : 'none',
      showScriptPopupMode: popupModeFromScript(s),
      detach: scriptKeepAlive(s),
      useHumanAsStdin: !!(s.useHumanAsStdin || s.passHumanInput || s.stdin),
    },
    _editId: asClone ? undefined : row.id,
    _cloneFrom: asClone ? row.id : undefined,
  }
}

function openCreate() {
  readonly.value = false
  const f = emptyForm()
  if (installDir.value) {
    f.script.scriptWorkDir = installDir.value
    f.script.scriptDir = installDir.value
  }
  form.value = f
  scriptTab.value = 'basic'
  drawerTitle.value = membersT('drawer.create')
  drawer.value = true
}

function openEdit(row) {
  readonly.value = false
  form.value = fillFromRow(row, { asClone: false })
  scriptTab.value = 'basic'
  drawerTitle.value = membersT('drawer.edit')
  drawer.value = true
}

function openClone(row) {
  readonly.value = false
  form.value = fillFromRow(row, { asClone: true })
  scriptTab.value = 'basic'
  drawerTitle.value = membersT('drawer.clone')
  drawer.value = true
}

function view(row) {
  readonly.value = true
  viewRow.value = row
  drawerTitle.value = membersT('drawer.view')
  drawer.value = true
}

async function save() {
  try {
    if (!form.value.displayName?.trim()) {
      ElMessage.warning(membersToast('saveWarnName'))
      return
    }
    const s = form.value.script
    if (form.value.kind === 'script') {
      const sw = String(s.scriptWorkDir || s.scriptDir || '').trim()
      if (!sw) {
        ElMessage.warning(membersToast('saveWarnWorkDir'))
        return
      }
      if (s.mode === 'file' && !String(s.filePath || '').trim()) {
        ElMessage.warning(membersToast('saveWarnFile'))
        return
      }
      if (s.mode === 'command' && !String(s.command || '').trim()) {
        ElMessage.warning(membersToast('saveWarnCommand'))
        return
      }
    }
    const desc = (form.value.description || '').trim()
    const baseConfig = {}
    if (desc) baseConfig.description = desc
    // 编辑时保留 demo / defaultText 等原有字段
    const prev =
      form.value._editId && list.value.find((m) => m.id === form.value._editId)?.config
    if (prev?.demo) baseConfig.demo = true
    if (form.value.kind === 'echo' && prev?.defaultText) {
      baseConfig.defaultText = prev.defaultText
    }

    if (prev?.role) baseConfig.role = prev.role
    if (form.value.adapt) baseConfig.adapt = true
    // 4.5 熔炉炼化：开启时写入 config.refine；取消只关 enabled，保留已学到的 format
    if (form.value.refine) {
      baseConfig.refine = {
        ...(prev?.refine || {}),
        enabled: true,
      }
    } else if (prev?.refine) {
      baseConfig.refine = {
        ...prev.refine,
        enabled: false,
      }
    }

    const prevRow = form.value._editId && list.value.find((m) => m.id === form.value._editId)
    const body = {
      displayName: form.value.displayName.trim(),
      name: prevRow?.name || form.value.displayName.trim(),
      kind: form.value.kind,
      config:
        form.value.kind === 'script'
          ? {
              ...baseConfig,
              script: {
                mode: s.mode,
                filePath: s.mode === 'file' ? s.filePath : undefined,
                scriptWorkDir: s.scriptWorkDir || s.scriptDir || undefined,
                scriptDir: s.scriptWorkDir || s.scriptDir || undefined,
                command: s.mode === 'command' ? s.command : undefined,
                runtime: s.runtime || 'auto',
                args: s.mode === 'file' ? parseArgs(s.argsText) : undefined,
                ...(Object.keys(parseEnvText(s.envText)).length
                  ? { env: parseEnvText(s.envText) }
                  : {}),
                executionMode: s.executionMode === 'pipe' ? 'pipe' : 'terminal',
                adapter: s.adapter === 'jsonl' ? 'jsonl' : undefined,
                ...popupFieldsFromMode(s.showScriptPopupMode || 'inherit'),
                detach: !!s.detach,
                waitForExit: !s.detach,
                useHumanAsStdin: !!s.useHumanAsStdin,
                passHumanInput: !!s.useHumanAsStdin,
              },
            }
          : { ...baseConfig },
    }
    if (form.value.refine) {
      const plan = await api.members.refinePlan({
        memberId: form.value._editId || undefined,
        displayName: body.displayName,
        kind: body.kind,
        config: body.config,
      })
      if (plan?.reason === 'will_patch' && plan.files?.length) {
        const lines = plan.files
          .filter((f) => f.willPatch)
          .map(
            (f) =>
              `· ${f.path}\n  ${String(f.snippet || '')
                .split('\n')
                .slice(0, 4)
                .join('\n  ')}`,
          )
          .join('\n\n')
        await ElMessageBox.confirm(
          membersPlanConfirmBody(plan.fileCount, lines),
          membersConfirm('planTitle'),
          {
            type: 'warning',
            confirmButtonText: membersConfirm('planOk'),
            cancelButtonText: membersConfirmCancel(),
          },
        )
      }
    }
    let saved
    if (form.value._editId) {
      saved = await api.members.update(form.value._editId, body)
    } else if (form.value._cloneFrom) {
      saved = await api.members.clone(form.value._cloneFrom, body)
    } else {
      saved = await api.members.create(body)
    }
    drawer.value = false
    await load()
    ElMessage.success(membersRefineSavedHint(saved, form.value.refine))
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function remove(row) {
  await ElMessageBox.confirm(membersRemoveConfirmBody(row.display_name), membersConfirm('removeTitle'), {
    type: 'warning',
  })
  try {
    await api.members.remove(row.id)
    await load()
    ElMessage.success(membersToast('removed'))
  } catch (e) {
    ElMessage.error(e.message)
  }
}

onMounted(() => {
  load()
  loadInstallDir()
  refreshRefineSkillPrompt()
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
.muted-dash {
  color: var(--el-text-color-secondary);
}
.page-search {
  max-width: 420px;
  margin-bottom: 16px;
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
  max-width: 520px;
}
.field-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.45;
}
.refine-skill-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.switch-hint {
  margin-left: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.member-script-tabs {
  margin: 12px 0 4px;
}
.member-script-tabs :deep(.el-tabs__content) {
  padding: 8px 4px 4px;
}
.member-script-tabs :deep(.el-form-item) {
  margin-bottom: 18px;
}
.member-script-tabs :deep(.el-form-item:last-child) {
  margin-bottom: 4px;
}
.member-settings-drawer :deep(.el-drawer__body) {
  padding: 8px 20px 24px;
}
.cfg-pre {
  margin: 0;
  white-space: pre-wrap;
  font-size: 12px;
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
