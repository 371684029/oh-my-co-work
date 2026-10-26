<template>
  <div class="shortcuts-page" role="region" :aria-label="t('a11y.shortcutsPage')">
    <div class="page-head">
      <div>
        <h2 id="shortcuts-page-title" class="page-title">{{ shortcutsT('title') }}</h2>
        <p class="page-desc">
          {{ shortcutsT('desc1') }}<code>/</code>{{ shortcutsT('desc2')
          }}<strong>{{ shortcutsT('descStrong1') }}</strong
          >{{ shortcutsT('desc3') }}<strong>{{ shortcutsT('descStrong2') }}</strong
          >{{ shortcutsT('desc4') }}
        </p>
      </div>
      <el-button type="primary" @click="openCreate">{{ shortcutsT('addBtn') }}</el-button>
    </div>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="hint"
      :title="shortcutsT('hint')"
    />

    <el-alert
      type="success"
      :closable="false"
      show-icon
      class="hint"
      :title="t('a11y.shortcutsBuiltinHotkeys')"
      role="region"
      :aria-label="t('a11y.shortcutsBuiltinHotkeys')"
    >
      <ul class="builtin-hotkeys">
        <li><kbd>Ctrl/Cmd+K</kbd> — {{ shortcutsT('builtin.palette') }}</li>
        <li><kbd>Ctrl/Cmd+Shift+D</kbd> — {{ shortcutsT('builtin.docs') }}</li>
        <li><kbd>Ctrl/Cmd+1</kbd> / <kbd>2</kbd> — {{ shortcutsT('builtin.switchTool') }}</li>
        <li>{{ shortcutsT('builtin.termPrefix') }}<kbd>Ctrl/Cmd+F</kbd
          >{{ shortcutsT('builtin.termMid') }}<kbd>Ctrl/Cmd+C</kbd
          >{{ shortcutsT('builtin.termSuffix') }}</li>
      </ul>
    </el-alert>

    <el-table :data="commands" stripe v-loading="loading" :aria-label="shortcutsT('a11y.list')">
      <el-table-column :label="shortcutsT('table.enabled')" width="72">
        <template #default="{ row }">
          <el-switch
            v-model="row.enabled"
            :aria-label="shortcutsToggleEnableAria(row.name)"
            @change="persist"
          />
        </template>
      </el-table-column>
      <el-table-column :label="shortcutsT('table.name')" prop="name" min-width="120" />
      <el-table-column :label="shortcutsT('table.trigger')" width="140">
        <template #default="{ row }">
          <code v-if="row.hotkeyScript || row.desktopHotkey" class="slash">⌨ {{ row.hotkey || shortcutsT('table.hotkeyFallback') }}</code>
          <code v-else class="slash">/{{ row.slash }}</code>
        </template>
      </el-table-column>
      <el-table-column :label="shortcutsT('table.kind')" width="100">
        <template #default="{ row }">
          {{ shortcutsKindLabel(row.kind) }}
        </template>
      </el-table-column>
      <el-table-column :label="shortcutsT('table.popup')" width="100">
        <template #default="{ row }">
          <span v-if="row.kind !== 'shell'">—</span>
          <span v-else>{{ popupLabel(row) }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="shortcutsT('table.target')" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <template v-if="row.kind === 'agent'">
            Agent · {{ row.memberName || row.memberKey || row.memberId || '—' }}
          </template>
          <template v-else-if="row.kind === 'url'">{{ row.url }}</template>
          <template v-else>{{ row.command }}</template>
        </template>
      </el-table-column>
      <el-table-column :label="shortcutsT('table.actions')" width="260" fixed="right">
        <template #default="{ row, $index }">
          <el-button link type="primary" @click="openEdit(row, $index)">{{ shortcutsT('actions.edit') }}</el-button>
          <el-button link type="primary" @click="openClone(row)">{{ shortcutsT('actions.clone') }}</el-button>
          <el-button link type="success" @click="tryRun(row)">{{ shortcutsT('actions.run') }}</el-button>
          <el-button link type="danger" @click="removeAt($index)">{{ shortcutsT('actions.remove') }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-drawer v-model="drawer" :title="drawerTitle" size="440px" destroy-on-close append-to-body>
      <el-form label-position="top">
        <el-form-item :label="shortcutsT('form.name')" required>
          <el-input v-model="form.name" :placeholder="shortcutsT('form.namePlaceholder')" />
        </el-form-item>
        <el-form-item :label="shortcutsT('form.hotkeyTrigger')">
          <el-switch v-model="form.hotkeyScript" />
          <p class="field-hint">
            {{ shortcutsT('form.hotkeyHint1') }}<code>/</code>{{ shortcutsT('form.hotkeyHint2')
            }}<strong>{{ shortcutsT('form.hotkeyHintStrong') }}</strong
            >{{ shortcutsT('form.hotkeyHint3') }}
          </p>
        </el-form-item>
        <el-form-item v-if="!form.hotkeyScript" :label="shortcutsT('form.slash')" required>
          <el-input v-model="form.slash" placeholder="editor">
            <template #prepend>/</template>
          </el-input>
        </el-form-item>
        <el-form-item v-else :label="shortcutsT('form.hotkey')">
          <el-input v-model="form.hotkey" :placeholder="shortcutsT('form.hotkeyPlaceholder')" />
        </el-form-item>
        <el-form-item v-if="form.hotkeyScript" :label="shortcutsT('form.slashInternal')" required>
          <el-input v-model="form.slash" placeholder="run_my_script">
            <template #prepend>/</template>
          </el-input>
          <p class="field-hint">{{ shortcutsT('form.slashInternalHint') }}</p>
        </el-form-item>
        <el-form-item :label="shortcutsT('form.desc')">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item :label="shortcutsT('form.kind')" required>
          <el-radio-group v-model="form.kind">
            <el-radio value="agent">{{ shortcutsT('form.kindAgent') }}</el-radio>
            <el-radio value="shell">{{ shortcutsT('form.kindShell') }}</el-radio>
            <el-radio value="url">{{ shortcutsT('form.kindUrl') }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <template v-if="form.kind === 'agent'">
          <el-form-item :label="shortcutsT('form.member')" required>
            <el-select
              v-model="form.memberId"
              filterable
              clearable
              :placeholder="shortcutsT('form.memberPlaceholder')"
              style="width: 100%"
              @change="onMemberPick"
            >
              <el-option
                v-for="m in members"
                :key="m.id"
                :label="m.display_name"
                :value="m.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item :label="shortcutsT('form.prompt')">
            <el-input
              v-model="form.prompt"
              type="textarea"
              :rows="2"
              :placeholder="shortcutsT('defaultPrompt')"
            />
          </el-form-item>
        </template>
        <template v-else-if="form.kind === 'shell'">
          <el-form-item :label="shortcutsT('form.command')" required>
            <el-input
              v-model="form.command"
              type="textarea"
              :rows="2"
              :placeholder="shortcutsT('form.commandPlaceholder')"
            />
          </el-form-item>
          <el-form-item :label="shortcutsT('form.scriptPath')">
            <PathPicker
              v-model="form.scriptPath"
              mode="file"
              :placeholder="shortcutsT('form.scriptPathPlaceholder')"
              :hint="
                form.hotkeyScript
                  ? shortcutsT('form.scriptPathHintHotkey')
                  : shortcutsT('form.scriptPathHintSlash')
              "
              @update:model-value="onSlashScriptPathChange"
            />
          </el-form-item>
          <el-form-item
            v-if="form.kind === 'shell'"
            :label="shortcutsT('form.workDir')"
            :required="shellHasScriptAnchor(form)"
          >
            <PathPicker
              v-model="form.scriptWorkDir"
              mode="folder"
              :placeholder="
                form.hotkeyScript
                  ? shortcutsT('form.workDirPlaceholderHotkey')
                  : shortcutsT('form.workDirPlaceholderSlash')
              "
              :hint="
                form.hotkeyScript
                  ? shortcutsT('form.workDirHintHotkey')
                  : shortcutsT('form.workDirHintSlash')
              "
            />
          </el-form-item>
          <el-form-item v-if="!form.hotkeyScript" :label="shortcutsT('form.anchor')">
            <el-select
              v-model="form.anchorMemberId"
              filterable
              clearable
              :placeholder="shortcutsT('form.anchorPlaceholder')"
              style="width: 100%"
            >
              <el-option
                v-for="m in scriptMembers"
                :key="m.id"
                :label="m.display_name"
                :value="m.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item :label="shortcutsT('form.openTarget')">
            <el-select v-model="form.openTarget" style="width: 100%">
              <el-option :label="shortcutsT('form.openTargetSession')" value="sessionWorkFolder" />
              <el-option :label="shortcutsT('form.customPath')" value="custom" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="form.openTarget === 'custom'" :label="shortcutsT('form.customPath')">
            <el-input v-model="form.customPath" placeholder="D:\projects\foo" />
          </el-form-item>
          <el-form-item :label="shortcutsT('form.popup')">
            <el-select v-model="form.showScriptPopupMode" style="width: 100%">
              <el-option :label="shortcutsT('form.popupInherit')" value="inherit" />
              <el-option :label="shortcutsT('form.popupYes')" value="yes" />
              <el-option :label="shortcutsT('form.popupNo')" value="no" />
            </el-select>
            <p class="field-hint">
              {{ shortcutsT('form.popupHint') }}
            </p>
          </el-form-item>
        </template>
        <template v-else>
          <el-form-item :label="shortcutsT('form.url')">
            <el-input v-model="form.url" placeholder="https://" />
          </el-form-item>
          <el-form-item :label="shortcutsT('form.promptForUrl')">
            <el-switch v-model="form.promptForUrl" />
          </el-form-item>
        </template>
        <el-form-item :label="shortcutsT('form.enabled')">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-button type="primary" @click="saveForm">{{ shortcutsT('form.save') }}</el-button>
      </el-form>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import ElMessage from 'element-plus/es/components/message/index.mjs'
import ElMessageBox from 'element-plus/es/components/message-box/index.mjs'
import { api } from '../../api'
import PathPicker from '../../components/PathPicker.vue'
import { t } from '../../i18n/index.js'
import {
  shortcutsT,
  shortcutsToast,
  shortcutsConfirm,
  shortcutsKindLabel,
  shortcutsPopupLabelForMode,
  shortcutsCloneName,
  shortcutsRunAgentOk,
  shortcutsToggleEnableAria,
  shortcutsDefaultMemberName,
  shortcutsDefaultPrompt,
} from '../../composables/settingsShortcutsCopy.js'

const commands = ref([])
const members = ref([])
const loading = ref(false)
const drawer = ref(false)
const drawerTitle = ref(shortcutsT('drawer.add'))
const editIndex = ref(-1)
const form = ref(emptyForm())

const scriptMembers = computed(() =>
  (members.value || []).filter((m) => m.kind === 'script'),
)

function emptyForm() {
  return {
    id: '',
    name: '',
    slash: '',
    description: '',
    enabled: true,
    kind: 'agent',
    command: 'code "{folder}"',
    url: 'https://',
    promptForUrl: false,
    openTarget: 'sessionWorkFolder',
    customPath: '',
    memberId: '',
    memberName: shortcutsDefaultMemberName(),
    memberKey: 'unified_admin',
    prompt: shortcutsDefaultPrompt(),
    /** inherit | yes | no — 仅 shell 有效 */
    showScriptPopupMode: 'inherit',
    scriptPath: '',
    scriptWorkDir: '',
    scriptDir: '',
    anchorMemberId: '',
    hotkeyScript: false,
    desktopHotkey: false,
    hotkey: '',
  }
}

const SCRIPT_EXT_RE = /\.(mjs|cjs|js|ts|tsx|jsx|bat|cmd|ps1|py|sh)$/i

function shellHasScriptAnchor(f) {
  if (!f || f.kind !== 'shell') return false
  if (String(f.scriptPath || '').trim()) return true
  if (!f.hotkeyScript && !f.desktopHotkey && String(f.anchorMemberId || '').trim()) return true
  const cmd = String(f.command || '').trim()
  if (!cmd) return false
  const parts = cmd.match(/(?:[^\s"'`]+|"[^"]*"|'[^']*')+/g) || []
  return parts.some((p) => {
    const t = p.replace(/^["']|["']$/g, '').trim()
    return t && SCRIPT_EXT_RE.test(t)
  })
}

function dirnameOfFilePath(p) {
  if (!p) return ''
  const norm = String(p).replace(/[/\\]+$/, '')
  const i = Math.max(norm.lastIndexOf('\\'), norm.lastIndexOf('/'))
  if (i <= 0) return norm
  if (/^[a-zA-Z]:$/.test(norm.slice(0, i))) return norm.slice(0, i + 1)
  return norm.slice(0, i) || norm
}

function onSlashScriptPathChange(v) {
  if (form.value.hotkeyScript || form.value.desktopHotkey) return
  const raw = (v ?? '').trim()
  if (!raw) return
  if (/^[a-zA-Z]:[\\/]|^\\\\|^\//.test(raw)) {
    const d = dirnameOfFilePath(raw)
    form.value.scriptWorkDir = d
    form.value.scriptDir = d
  }
}

function popupModeFromCmd(row = {}) {
  if (row.showScriptPopup === true) return 'yes'
  if (row.showScriptPopup === false) return 'no'
  return 'inherit'
}

function popupLabel(row) {
  return shortcutsPopupLabelForMode(popupModeFromCmd(row))
}

function applyPopupModeToCmd(f) {
  const mode = f.showScriptPopupMode || 'inherit'
  const out = { ...f }
  delete out.showScriptPopupMode
  if (out.kind !== 'shell') {
    delete out.showScriptPopup
    return out
  }
  if (mode === 'yes') out.showScriptPopup = true
  else if (mode === 'no') out.showScriptPopup = false
  else delete out.showScriptPopup
  return out
}

function onMemberPick(id) {
  const m = members.value.find((x) => x.id === id)
  if (m) {
    form.value.memberName = m.display_name
    form.value.memberKey = m.name
  }
}

async function load() {
  loading.value = true
  try {
    const [r, mem] = await Promise.all([api.slashCommands.list(), api.members.list()])
    commands.value = r.commands || []
    members.value = mem || []
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

async function persist() {
  try {
    const r = await api.slashCommands.save(commands.value)
    commands.value = r.commands || commands.value
    ElMessage.success(shortcutsToast('saved'))
  } catch (e) {
    ElMessage.error(e.message)
    await load()
  }
}

function openCreate() {
  editIndex.value = -1
  form.value = emptyForm()
  form.value.id = `cmd_${Date.now().toString(36)}`
  drawerTitle.value = shortcutsT('drawer.add')
  drawer.value = true
}

function openEdit(row, index) {
  editIndex.value = index
  form.value = {
    ...emptyForm(),
    ...row,
    scriptWorkDir: row.scriptWorkDir || row.scriptDir || '',
    scriptDir: row.scriptWorkDir || row.scriptDir || '',
    hotkeyScript: !!(row.hotkeyScript || row.desktopHotkey),
    desktopHotkey: !!(row.hotkeyScript || row.desktopHotkey),
    hotkey: row.hotkey || '',
    showScriptPopupMode: popupModeFromCmd(row),
  }
  drawerTitle.value = shortcutsT('drawer.edit')
  drawer.value = true
}

function openClone(row) {
  editIndex.value = -1
  const baseSlash = String(row.slash || 'cmd').replace(/^\//, '')
  let slash = `${baseSlash}_copy`
  let n = 2
  const used = new Set(commands.value.map((c) => c.slash.toLowerCase()))
  while (used.has(slash.toLowerCase())) {
    slash = `${baseSlash}_copy${n++}`
  }
  form.value = {
    ...emptyForm(),
    ...row,
    id: `cmd_${Date.now().toString(36)}`,
    name: shortcutsCloneName(row.name || baseSlash),
    slash,
    scriptWorkDir: row.scriptWorkDir || row.scriptDir || '',
    scriptDir: row.scriptWorkDir || row.scriptDir || '',
    hotkeyScript: !!(row.hotkeyScript || row.desktopHotkey),
    desktopHotkey: !!(row.hotkeyScript || row.desktopHotkey),
    hotkey: row.hotkey || '',
    showScriptPopupMode: popupModeFromCmd(row),
  }
  drawerTitle.value = shortcutsT('drawer.clone')
  drawer.value = true
}

async function saveForm() {
  let f = { ...form.value }
  f.slash = String(f.slash || '')
    .replace(/^\//, '')
    .trim()
  if (!f.name.trim() || !f.slash) {
    ElMessage.warning(shortcutsToast('saveWarn'))
    return
  }
  if (f.kind === 'shell' && shellHasScriptAnchor(f)) {
    const sw = String(f.scriptWorkDir || f.scriptDir || '').trim()
    if (!sw) {
      ElMessage.warning(shortcutsToast('workDirWarn'))
      return
    }
  }
  if (f.hotkeyScript || f.desktopHotkey) {
    f.hotkeyScript = true
    f.desktopHotkey = true
    f.anchorMemberId = ''
  } else {
    f.hotkeyScript = false
    f.desktopHotkey = false
  }
  f = applyPopupModeToCmd(f)
  const sw = String(f.scriptWorkDir || f.scriptDir || '').trim()
  if (sw) {
    f.scriptWorkDir = sw
    f.scriptDir = sw
  }
  if (editIndex.value >= 0) {
    commands.value[editIndex.value] = f
  } else {
    commands.value.push(f)
  }
  drawer.value = false
  await persist()
}

async function removeAt(index) {
  await ElMessageBox.confirm(shortcutsConfirm('removeBody'), shortcutsConfirm('removeTitle'), {
    type: 'warning',
  })
  commands.value.splice(index, 1)
  await persist()
}

async function tryRun(row) {
  try {
    let url
    if (row.kind === 'url' && row.promptForUrl) {
      const { value } = await ElMessageBox.prompt(shortcutsConfirm('runUrl'), shortcutsConfirm('runTitle'), {
        inputValue: row.url || 'https://',
      })
      url = value
    }
    const r = await api.slashCommands.run(row.id, { url })
    if (r.kind === 'url' && r.url) {
      window.open(r.url, '_blank', 'noopener')
    }
    if (r.kind === 'agent') {
      ElMessage.success(r.message || shortcutsRunAgentOk(r.memberName))
      return
    }
    ElMessage.success(r.message || shortcutsToast('runOk'))
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
  gap: 16px;
  margin-bottom: 16px;
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
  line-height: 1.5;
}
.field-hint {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--el-text-color-secondary);
}
.page-desc code {
  background: var(--el-fill-color-light);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12px;
}
.hint {
  margin-bottom: 16px;
  border-radius: 12px;
}
.slash {
  font-size: 12px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  padding: 2px 8px;
  border-radius: 6px;
}
</style>
