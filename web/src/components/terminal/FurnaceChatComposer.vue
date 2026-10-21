<template>
  <form
    class="furnace-composer"
    @submit.prevent="$emit('submit')"
    @dragover.prevent
    @drop.prevent="$emit('drop', $event)"
  >
    <input
      ref="fileInputEl"
      type="file"
      multiple
      class="furnace-file-input"
      @change="$emit('file-input-change', $event)"
    />
    <el-alert
      v-if="showInputTips"
      type="info"
      :closable="true"
      show-icon
      class="furnace-input-tips"
      :title="furnaceInputTipsTitle()"
      :description="furnaceInputTipsDescription()"
      @close="$emit('dismiss-tips')"
    />
    <div class="furnace-compose-main">
      <textarea
        ref="composerEl"
        :value="modelValue"
        rows="3"
        :disabled="!isRunning"
        :placeholder="furnaceChatPlaceholder()"
        @input="$emit('update:modelValue', $event.target.value)"
        @keydown="$emit('composer-keydown', $event)"
        @paste="$emit('paste', $event)"
      />
      <div v-if="pendingFiles.length" class="furnace-pending">
        <span
          v-for="(f, i) in pendingFiles"
          :key="f.id || f.relPath"
          class="furnace-pending-chip"
        >
          {{ f.name }}
          <button type="button" :title="furnaceRemovePendingTitle()" @click="$emit('remove-pending', i)">
            ×
          </button>
        </span>
      </div>
      <div class="furnace-compose-bar">
        <button
          type="button"
          class="furnace-btn"
          :disabled="!isRunning || uploading || !sessionId"
          :title="furnaceAttachmentTitle()"
          @click="$emit('pick-files')"
        >
          {{ furnaceAttachmentButtonLabel(uploading) }}
        </button>
        <span v-if="uploadError" class="furnace-upload-err">{{ uploadError }}</span>
        <span class="furnace-compose-hint">{{ furnaceComposeBarHint() }}</span>
      </div>
    </div>
    <button type="submit" class="furnace-send" :disabled="!canSend">{{ furnaceSendLabel() }}</button>
  </form>
</template>

<script setup>
import { ref } from 'vue'
import {
  furnaceAttachmentButtonLabel,
  furnaceAttachmentTitle,
  furnaceChatPlaceholder,
  furnaceComposeBarHint,
  furnaceInputTipsDescription,
  furnaceInputTipsTitle,
  furnaceRemovePendingTitle,
  furnaceSendLabel,
} from '../../composables/furnaceWorkspaceCopy.js'

defineProps({
  modelValue: { type: String, default: '' },
  pendingFiles: { type: Array, default: () => [] },
  uploading: { type: Boolean, default: false },
  uploadError: { type: String, default: '' },
  isRunning: { type: Boolean, default: false },
  sessionId: { type: String, default: '' },
  showInputTips: { type: Boolean, default: false },
  canSend: { type: Boolean, default: false },
})

defineEmits([
  'update:modelValue',
  'submit',
  'file-input-change',
  'drop',
  'paste',
  'composer-keydown',
  'remove-pending',
  'pick-files',
  'dismiss-tips',
])

const fileInputEl = ref(null)
const composerEl = ref(null)

defineExpose({
  fileInput: fileInputEl,
  composerEl,
})
</script>

<style scoped>
.furnace-composer {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  padding: 12px 3% 16px;
  background: rgba(255, 255, 255, 0.92);
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.furnace-file-input {
  display: none;
}

.furnace-compose-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.furnace-composer textarea {
  flex: 1;
  width: 100%;
  resize: none;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 14px;
  padding: 12px 14px;
  font: inherit;
  font-size: 15px;
  min-height: 72px;
  box-sizing: border-box;
}

.furnace-pending {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.furnace-pending-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 16rem;
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.06);
}

.furnace-pending-chip button {
  border: 0;
  background: transparent;
  cursor: pointer;
  color: #6e6e73;
  font-size: 14px;
  line-height: 1;
  padding: 0;
}

.furnace-compose-bar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.furnace-compose-hint,
.furnace-upload-err {
  font-size: 11px;
  color: #6e6e73;
}

.furnace-upload-err {
  color: #ff3b30;
}

.furnace-send {
  border: 0;
  border-radius: 12px;
  padding: 12px 18px;
  background: #007aff;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}

.furnace-send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
