<template>
  <div class="restore-center" role="region" aria-labelledby="restore-center-title">
    <h2 id="restore-center-title">{{ restoreT('title') }}</h2>
    <DocsRefineChangesPane />
  </div>
</template>

<script setup>
import { restoreT } from '../../composables/settingsRestoreCopy.js'
import DocsRefineChangesPane from '../docs/DocsRefineChangesPane.vue'
</script>

<style scoped>
.restore-center {
  max-width: 820px;
}
.restore-center h2 {
  font-size: 18px;
  margin: 0 0 8px;
  padding: 0 20px;
}
</style>
