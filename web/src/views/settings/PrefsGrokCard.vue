<template>
  <section class="prefs-card">
    <div class="prefs-title">{{ prefsT('grok.title') }}</div>
    <p class="prefs-hint">
      {{ prefsT('grok.hintPrefix') }}
      <router-link to="/settings/grok">{{ prefsT('grok.hintLink') }}</router-link>。
    </p>
    <el-form label-position="top" class="admin-form">
      <el-form-item :label="prefsT('grok.workspaceDir')">
        <el-input
          :model-value="workspaceDir"
          :placeholder="prefsT('grok.workspaceDirPlaceholder')"
          @update:model-value="$emit('update:workspaceDir', $event)"
        />
        <p class="prefs-resolved">{{ prefsT('grok.workspaceDirHint') }}</p>
      </el-form-item>
      <el-form-item :label="prefsT('grok.configured')">
        <el-switch :model-value="configured" @update:model-value="$emit('update:configured', $event)" />
        <p class="prefs-resolved">{{ prefsT('grok.configuredHint') }}</p>
      </el-form-item>
      <el-form-item :label="prefsT('grok.command')">
        <el-input
          :model-value="command"
          placeholder="grok"
          @update:model-value="$emit('update:command', $event)"
        />
      </el-form-item>
      <el-form-item :label="prefsT('grok.cursorCommand')">
        <el-input
          :model-value="cursorCommand"
          placeholder="cursor-agent"
          @update:model-value="$emit('update:cursorCommand', $event)"
        />
        <p class="prefs-resolved">{{ prefsT('grok.cursorHint') }}</p>
      </el-form-item>
      <el-form-item :label="prefsT('grok.defaultSurface')">
        <el-radio-group :model-value="surface" @update:model-value="$emit('update:surface', $event)">
          <el-radio value="tui">{{ prefsT('grok.surfaceTui') }}</el-radio>
        </el-radio-group>
        <p class="prefs-resolved">{{ prefsT('grok.surfaceHint') }}</p>
      </el-form-item>
      <el-form-item :label="prefsT('grok.refineSourceBackup')">
        <el-switch
          :model-value="refineSourceBackup"
          @update:model-value="$emit('update:refineSourceBackup', $event)"
        />
        <p class="prefs-resolved">{{ prefsT('grok.refineSourceBackupHint') }}</p>
      </el-form-item>
    </el-form>
    <el-button type="primary" plain size="small" :loading="saving" @click="$emit('save')">
      {{ prefsT('grok.save') }}
    </el-button>
  </section>
</template>

<script setup>
import { prefsT } from '../../composables/settingsPrefsCopy.js'

defineProps({
  workspaceDir: { type: String, default: '' },
  configured: { type: Boolean, default: true },
  command: { type: String, default: 'grok' },
  cursorCommand: { type: String, default: 'cursor-agent' },
  surface: { type: String, default: 'tui' },
  refineSourceBackup: { type: Boolean, default: true },
  saving: { type: Boolean, default: false },
})

defineEmits([
  'save',
  'update:workspaceDir',
  'update:configured',
  'update:command',
  'update:cursorCommand',
  'update:surface',
  'update:refineSourceBackup',
])
</script>