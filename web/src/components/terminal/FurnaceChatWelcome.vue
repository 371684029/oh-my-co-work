<template>
  <div v-if="showFail" class="furnace-welcome is-fail">
    <p class="furnace-welcome-kicker">{{ welcomeKicker }}</p>
    <h3>{{ furnaceFailHeading(agentLabel) }}</h3>
    <p>{{ failHint }}</p>
    <ul>
      <li>
        {{ t('furnace.welcome.failBulletPathBefore') }}
        <code>{{ activeAgent === 'cursor' ? 'cursor-agent' : 'grok' }}</code>
        {{ t('furnace.welcome.failBulletPathAfter') }}
      </li>
      <li>{{ t('furnace.welcome.failBulletWindowsPath') }}</li>
      <li>{{ t('furnace.welcome.failBulletNewFurnace') }}</li>
    </ul>
    <div class="furnace-chips">
      <button type="button" class="furnace-chip" @click="$emit('view-tui')">
        {{ furnaceFailChipViewTui() }}
      </button>
      <button type="button" class="furnace-chip" @click="$emit('reopen')">
        {{ furnaceFailChipReopen() }}
      </button>
      <button type="button" class="furnace-chip" @click="$emit('close')">
        {{ furnaceFailChipBackToChat() }}
      </button>
    </div>
  </div>
  <div v-else-if="showWelcome" class="furnace-welcome">
    <p class="furnace-welcome-kicker">{{ welcomeKicker }}</p>
    <h3>{{ welcomeTitle }}</h3>
    <p>
      <template v-if="activeAgent === 'cursor'">
        {{ furnaceWelcomeIntroCursor(agentBrand) }}
      </template>
      <template v-else>
        {{ furnaceWelcomeIntroGrok(agentBrand) }}
      </template>
    </p>
    <ul>
      <li v-for="(line, i) in furnaceWelcomeListItems()" :key="i">{{ line }}</li>
    </ul>
    <div class="furnace-chips">
      <button
        v-for="chip in quickChips"
        :key="chip"
        type="button"
        class="furnace-chip"
        :disabled="!isRunning"
        @click="$emit('send-chip', chip)"
      >
        {{ chip }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { t } from '../../i18n/index.js'
import {
  furnaceFailChipBackToChat,
  furnaceFailChipReopen,
  furnaceFailChipViewTui,
  furnaceFailHeading,
  furnaceWelcomeIntroCursor,
  furnaceWelcomeIntroGrok,
  furnaceWelcomeListItems,
} from '../../composables/furnaceWelcomeUi.js'

defineProps({
  showFail: { type: Boolean, default: false },
  showWelcome: { type: Boolean, default: false },
  welcomeKicker: { type: String, default: '' },
  welcomeTitle: { type: String, default: '' },
  agentLabel: { type: String, default: '' },
  activeAgent: { type: String, default: 'grok' },
  agentBrand: { type: String, default: '' },
  failHint: { type: String, default: '' },
  quickChips: { type: Array, default: () => [] },
  isRunning: { type: Boolean, default: false },
})

defineEmits(['view-tui', 'reopen', 'close', 'send-chip'])
</script>

<style scoped>
.furnace-welcome {
  max-width: min(52rem, 100%);
  margin: 0;
  padding: 18px 20px 16px;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 1px 10px rgba(0, 0, 0, 0.06);
  color: #1d1d1f;
}

.furnace-welcome.is-fail {
  background: #fff6f6;
  box-shadow: 0 1px 10px rgba(255, 59, 48, 0.08);
}

.furnace-welcome-kicker {
  margin: 0 0 6px;
  font-size: 11px;
  letter-spacing: 0.04em;
  color: #6e6e73;
}

.furnace-welcome h3 {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.furnace-welcome p,
.furnace-welcome li {
  font-size: 14px;
  line-height: 1.65;
  color: #3a3a40;
}

.furnace-welcome p {
  margin: 0 0 10px;
}

.furnace-welcome ul {
  margin: 0 0 14px;
  padding-left: 1.15rem;
}

.furnace-welcome :deep(code) {
  font-size: 12px;
  padding: 1px 5px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.05);
}

.furnace-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.furnace-chip {
  border: 0;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  background: rgba(0, 122, 255, 0.1);
  color: #007aff;
}

.furnace-chip:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
