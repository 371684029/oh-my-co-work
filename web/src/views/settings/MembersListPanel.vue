<template>
  <div class="members-list-panel">
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
        <el-button @click="$emit('import')">{{ membersT('importBtn') }}</el-button>
        <el-button type="primary" @click="$emit('create')">{{ membersT('createBtn') }}</el-button>
      </div>
    </div>

    <el-input
      :model-value="searchQ"
      class="page-search"
      :placeholder="membersT('searchPlaceholder')"
      clearable
      :prefix-icon="SearchIcon"
      :aria-label="membersT('a11y.search')"
      @update:model-value="$emit('update:searchQ', $event)"
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
          <el-tag v-if="row.config?.refine?.enabled" size="small" type="success" effect="plain">{{
            membersT('table.refineOn')
          }}</el-tag>
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
          <el-button link type="primary" @click="$emit('edit', row)">{{ membersT('actions.edit') }}</el-button>
          <el-button link type="primary" @click="$emit('clone', row)">{{ membersT('actions.clone') }}</el-button>
          <el-button link type="primary" @click="$emit('export', row)">{{ membersT('actions.export') }}</el-button>
          <el-button link type="info" @click="$emit('view', row)">{{ membersT('actions.view') }}</el-button>
          <el-button link type="danger" @click="$emit('remove', row)">{{ membersT('actions.remove') }}</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { Search } from '@element-plus/icons-vue'
import { membersT } from '../../composables/settingsMembersCopy.js'

defineProps({
  filteredList: { type: Array, default: () => [] },
  searchQ: { type: String, default: '' },
  runSummary: { type: Function, required: true },
})

defineEmits(['import', 'create', 'update:searchQ', 'edit', 'clone', 'export', 'view', 'remove'])

const SearchIcon = Search
</script>