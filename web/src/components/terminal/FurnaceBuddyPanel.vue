<template>
  <aside class="furnace-buddy">
    <FurnaceAvatar size="lg" :mood="mood" :live="live" :title="title" />
    <p class="furnace-buddy-credit" :title="PET_COPYRIGHT">{{ PET_CREDIT_SHORT }}</p>
    <p class="furnace-buddy-line">{{ buddyLine }}</p>
  </aside>
</template>

<script setup>
import FurnaceAvatar from '../FurnaceAvatar.vue'
import { PET_COPYRIGHT, PET_CREDIT_SHORT } from '../../composables/furnacePetAtlas.js'

defineProps({
  mood: { type: String, default: '' },
  live: { type: Boolean, default: false },
  title: { type: String, default: '' },
  buddyLine: { type: String, default: '' },
})
</script>

<style scoped>
.furnace-buddy {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.furnace-buddy-credit {
  margin: 0;
  font-size: 10px;
  line-height: 1.35;
  color: #8e8ea0;
}

.furnace-buddy-line {
  margin: 0;
  max-width: 7.5rem;
  font-size: 11px;
  line-height: 1.45;
  color: #6e6e73;
}

@media (max-width: 820px) {
  .furnace-buddy {
    position: static;
    flex-direction: row;
    text-align: left;
    max-width: none;
  }
}
</style>
