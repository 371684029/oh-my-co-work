<template>
  <section class="prefs-card">
    <div class="prefs-title">{{ prefsT('furnaceSkills.title') }}</div>
    <p class="prefs-hint">{{ prefsT('furnaceSkills.hint') }}</p>
    <p v-if="workspace" class="prefs-resolved">
      {{ prefsT('furnaceSkills.workspace') }}：{{ workspace }}
      <span v-if="needsWorkspaceAck" class="prefs-warn">
        {{ prefsT('furnaceSkills.workspaceAckHint') }}
      </span>
    </p>
    <el-table v-if="skills.length" :data="skills" size="small" class="furnace-skills-table">
      <el-table-column prop="id" :label="prefsT('furnaceSkills.colId')" width="200" />
      <el-table-column prop="version" :label="prefsT('furnaceSkills.colVersion')" width="88" />
      <el-table-column prop="description" :label="prefsT('furnaceSkills.colDesc')" />
    </el-table>
    <el-button
      type="primary"
      plain
      size="small"
      class="furnace-skills-sync"
      :loading="syncing"
      @click="$emit('sync')"
    >
      {{ prefsT('furnaceSkills.sync') }}
    </el-button>
  </section>
</template>

<script setup>
import { prefsT } from '../../composables/settingsPrefsCopy.js'

defineProps({
  skills: { type: Array, default: () => [] },
  workspace: { type: String, default: '' },
  needsWorkspaceAck: { type: Boolean, default: false },
  syncing: { type: Boolean, default: false },
})

defineEmits(['sync'])
</script>

<style scoped>
.prefs-warn {
  display: block;
  margin-top: 4px;
  color: var(--el-color-warning);
  font-size: 12px;
}
</style>