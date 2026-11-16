<template>
  <el-popover
    v-model:visible="open"
    placement="bottom-end"
    width="480"
    trigger="click"
    popper-class="chat-search-popper"
  >
    <template #reference>
      <button
        type="button"
        class="global-chat-search-btn"
        :aria-label="workbenchSearchChatAria()"
        :title="workbenchSearchChatLabel()"
      >
        <AcwIcon name="search" :size="16" />
      </button>
    </template>
    <div class="chat-search-box">
      <el-input
        v-model="query"
        :placeholder="workbenchSearchPlaceholder()"
        :aria-label="workbenchSearchChatAria()"
        clearable
        @input="runSearch"
        @keyup.enter="runSearch"
      />
      <div v-if="loading" class="chat-search-empty" role="status">
        {{ workbenchSearchLoading() }}
      </div>
      <template v-else-if="hits.length">
        <div
          v-for="(hit, i) in hits"
          :key="hit.messageId || i"
          class="chat-search-hit"
          @click="jumpToHit(hit)"
        >
          <div class="chat-search-hit-meta">
            <span class="hit-sender">{{ chatSearchHitSenderLabel(hit) }}</span>
            <span v-if="hit.sessionTitle" class="hit-session">{{ hit.sessionTitle }}</span>
          </div>
          <div class="chat-search-hit-snippet">{{ hit.snippet }}</div>
        </div>
      </template>
      <div v-else class="chat-search-empty" role="status">{{ workbenchSearchEmpty() }}</div>
    </div>
  </el-popover>
</template>

<script setup>
import { nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import AcwIcon from './icons/AcwIcon.vue'
import { api } from '../api'
import { activeId } from '../views/workbench/composables/useSessionDetail'
import { workbenchSessionRoute } from '../views/workbench/composables/sessionLoadListsUi.js'
import {
  workbenchSearchChatLabel,
  workbenchSearchChatAria,
  workbenchSearchPlaceholder,
  workbenchSearchLoading,
  workbenchSearchEmpty,
} from '../views/workbench/composables/workbenchChromeCopy.js'
import {
  WORKBENCH_CHAT_SEARCH_DEBOUNCE_MS,
  canRunChatSearch,
  chatSearchHitSenderLabel,
  nextChatSearchSeq,
  shouldApplyChatSearchResponse,
  scrollChatMessageIntoView,
} from '../views/workbench/composables/workbenchChatSearchUi.js'
import { setPendingChatScrollMessageId } from '../views/workbench/composables/chatSearchScrollPending.js'

const router = useRouter()
const open = ref(false)
const query = ref('')
const loading = ref(false)
const hits = ref([])
let searchTimer = null
let searchSeq = 0

function runSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(fireSearch, WORKBENCH_CHAT_SEARCH_DEBOUNCE_MS)
}

async function fireSearch() {
  const q = query.value.trim()
  hits.value = []
  if (!canRunChatSearch(q)) return
  const seq = nextChatSearchSeq(searchSeq)
  searchSeq = seq
  loading.value = true
  try {
    const res = await api.messages.find(q)
    if (!shouldApplyChatSearchResponse(seq, searchSeq)) return
    hits.value = res.hits || []
  } catch (e) {
    if (!shouldApplyChatSearchResponse(seq, searchSeq)) return
    hits.value = []
    console.warn('[acw] global chat search', e?.message || e)
  } finally {
    if (seq === searchSeq) loading.value = false
  }
}

async function jumpToHit(hit) {
  open.value = false
  query.value = ''
  hits.value = []
  const messageId = hit.messageId
  const sessionId = hit.sessionId
  if (!sessionId) return
  if (messageId) setPendingChatScrollMessageId(messageId)
  const sameSession = activeId.value === sessionId
  await router.push(workbenchSessionRoute(sessionId))
  if (sameSession && messageId) {
    await nextTick()
    scrollChatMessageIntoView(messageId)
  }
}
</script>

<style scoped>
.global-chat-search-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  cursor: pointer;
}
.global-chat-search-btn:hover {
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
}
.chat-search-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: min(60vh, 420px);
}
.chat-search-empty {
  padding: 12px 4px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  text-align: center;
}
.chat-search-hit {
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
}
.chat-search-hit:hover {
  background: var(--el-fill-color-light);
}
.chat-search-hit-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  margin-bottom: 4px;
}
.chat-search-hit-meta .hit-sender {
  font-weight: 600;
}
.chat-search-hit-meta .hit-session {
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chat-search-hit-snippet {
  font-size: 13px;
  line-height: 1.45;
  color: var(--el-text-color-regular);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>