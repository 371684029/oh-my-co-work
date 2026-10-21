<template>
  <div class="acw-empty" role="status">
    <p v-if="title" class="acw-empty-title">{{ title }}</p>
    <p v-if="description" class="acw-empty-desc">{{ description }}</p>
    <div v-if="$slots.default" class="acw-empty-actions">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
})
</script>

<style scoped>
.acw-empty {
  padding: 20px 12px;
  text-align: center;
}

.acw-empty-title {
  margin: 0 0 6px;
  font-size: var(--ecw-font-sm, 13px);
  font-weight: 600;
  color: var(--ecw-text-1, #1d1d1f);
}

.acw-empty-desc {
  margin: 0;
  font-size: var(--ecw-font-xs, 12px);
  color: var(--ecw-text-2, #6e6e73);
  line-height: 1.45;
}

.acw-empty-actions {
  margin-top: 12px;
}
</style>
