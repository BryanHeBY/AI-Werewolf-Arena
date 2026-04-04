<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useVirtualList } from "@vueuse/core";
import { useGameStore } from "@/stores/gameStore";
import type { ChatMessage } from "@/types/v2-types";
import { MessageSquare, AlertTriangle, Bot } from "lucide-vue-next";

const props = withDefaults(
  defineProps<{
    testMode?: boolean;
    messages?: ChatMessage[];
    myViewId?: number;
  }>(),
  {
    testMode: false,
    messages: () => [],
    myViewId: 0,
  },
);

const gameStore = useGameStore();
const scrollContainer = ref<HTMLElement>();
const shouldAutoScroll = ref(true);

// Get messages based on mode
const chatMessages = computed(() => {
  if (props.testMode) {
    return props.messages;
  }

  return gameStore.chatMessages.filter((message) => {
    // Show private thoughts only to god view (0) or the player themselves
    if (message.privateThought) {
      return (
        gameStore.myViewId === 0 || gameStore.myViewId === message.playerId
      );
    }
    return true;
  });
});

// Get current view ID based on mode
const currentViewId = computed(() => {
  return props.testMode ? props.myViewId : gameStore.myViewId;
});

// Virtual scroll configuration
const {
  list: virtualList,
  containerProps,
  wrapperProps,
  scrollTo,
} = useVirtualList(chatMessages, {
  itemHeight: 120, // Estimated height per message
  overscan: 10,
});

// Determine message alignment
const getMessageAlignment = (message: ChatMessage) => {
  if (!message.playerId && message.playerId !== 0) return "center"; // System messages
  if (message.playerId === -1) return "center"; // Judge/God messages
  if (message.playerId === currentViewId.value) return "right"; // Own messages
  return "left"; // Others
};

// Determine message color theme
const getMessageColor = (message: ChatMessage) => {
  const alignment = getMessageAlignment(message);
  if (alignment === "center")
    return {
      bg: "bg-surface",
      border: "border-neon-red",
      glow: "shadow-glow-red",
      text: "text-neon-red",
    };
  if (alignment === "right")
    return {
      bg: "bg-surface",
      border: "border-neon-blue",
      glow: "shadow-glow-blue",
      text: "text-neon-blue",
    };
  return {
    bg: "bg-surface",
    border: "border-neon-purple",
    glow: "shadow-glow-purple",
    text: "text-neon-purple",
  };
};

// Get message icon
const getMessageIcon = (message: ChatMessage) => {
  const alignment = getMessageAlignment(message);
  if (alignment === "center") return AlertTriangle;
  if (alignment === "right") return MessageSquare;
  return Bot;
};

// Format timestamp
const formatTimestamp = (timestamp: number) => {
  if (!timestamp || isNaN(timestamp)) return "";
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Auto-scroll to bottom on new messages
watch(
  () => chatMessages.value.length,
  async () => {
    if (shouldAutoScroll.value) {
      await nextTick();
      scrollToBottom();
    }
  },
);

const scrollToBottom = () => {
  if (chatMessages.value.length === 0) return;
  scrollTo(chatMessages.value.length - 1);
};

const handleScroll = () => {
  if (!scrollContainer.value) return;
  const { scrollTop, scrollHeight, clientHeight } = scrollContainer.value;
  const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
  shouldAutoScroll.value = isNearBottom;
};
</script>

<template>
  <div
    class="chat-container relative h-full w-full bg-background border border-border rounded-lg overflow-hidden"
  >
    <!-- Header -->
    <div
      class="bg-surface border-b border-border p-3 flex items-center justify-between z-10 relative"
    >
      <div class="flex items-center gap-2">
        <MessageSquare :size="18" class="text-neon-cyan" />
        <span class="font-mono text-sm text-neon-cyan">聊天流</span>
        <span
          class="font-mono text-xs text-textMuted bg-surface px-2 py-1 rounded border border-border"
        >
          {{ chatMessages.length }} 条消息
        </span>
      </div>
      <div class="flex items-center gap-2 text-xs font-mono text-textMuted">
        <span>视角: P{{ currentViewId }}</span>
      </div>
    </div>

    <!-- Virtual Scroll Container -->
    <div
      ref="scrollContainer"
      v-bind="containerProps"
      class="flex-1 overflow-auto relative bg-black/30"
      @scroll="handleScroll"
    >
      <div v-bind="wrapperProps" class="relative w-full">
        <!-- Virtual List Items -->
        <div
          v-for="{ data: message, index } in virtualList"
          :key="message.id || index"
          class="absolute w-full px-4 py-2 transition-all duration-200"
          :style="{ top: `${index * 120}px` }"
        >
          <div
            :class="[
              'flex gap-3 transition-all duration-300',
              getMessageAlignment(message) === 'center' ? 'justify-center' : '',
              getMessageAlignment(message) === 'right'
                ? 'flex-row-reverse'
                : '',
            ]"
          >
            <!-- Avatar/Icon -->
            <div
              :class="[
                'flex items-center justify-center w-10 h-10 rounded-lg border-2 shrink-0 transition-all duration-300',
                getMessageColor(message).bg,
                getMessageColor(message).border,
                getMessageColor(message).glow,
              ]"
            >
              <component
                :is="getMessageIcon(message)"
                :size="20"
                :class="getMessageColor(message).text"
              />
            </div>

            <!-- Message Bubble -->
            <div
              :class="[
                'max-w-[70%] p-4 rounded-lg border transition-all duration-300 relative',
                getMessageColor(message).bg,
                getMessageColor(message).border,
                getMessageColor(message).glow,
                getMessageAlignment(message) === 'center'
                  ? 'bg-surface/80 border-neon-red/50'
                  : '',
              ]"
            >
              <!-- Player Name (if not centered) -->
              <div
                v-if="
                  getMessageAlignment(message) !== 'center' &&
                  message.playerName
                "
                class="font-mono text-xs mb-2 pb-2 border-b border-border/30 flex items-center gap-2"
              >
                <span :class="getMessageColor(message).text" class="font-bold">
                  {{ message.playerName }}
                </span>
                <span class="text-textMuted">ID:{{ message.playerId }}</span>
                <span
                  v-if="formatTimestamp(message.timestamp)"
                  class="ml-auto text-textMuted"
                >
                  {{ formatTimestamp(message.timestamp) }}
                </span>
              </div>

              <!-- Message Type Indicator (for centered messages) -->
              <div
                v-if="getMessageAlignment(message) === 'center'"
                class="font-mono text-xs mb-2 pb-2 border-b border-neon-red/30 flex items-center gap-2"
              >
                <span class="text-neon-red font-bold animate-pulse">
                  {{ message.type === "system" ? "系统消息" : "法官" }}
                </span>
                <span
                  v-if="formatTimestamp(message.timestamp)"
                  class="ml-auto text-textMuted"
                >
                  {{ formatTimestamp(message.timestamp) }}
                </span>
              </div>

              <!-- Message Content -->
              <div
                class="font-mono text-sm leading-relaxed text-text break-words"
              >
                {{ message.content }}
              </div>

              <!-- Private Thought (if visible) -->
              <div
                v-if="message.privateThought"
                class="mt-3 pt-3 border-t border-border/30"
              >
                <div
                  class="text-xs font-mono text-textMuted mb-1 flex items-center gap-2"
                >
                  <div
                    class="w-2 h-2 rounded-full bg-neon-cyan animate-pulse"
                  />
                  <span>内心独白</span>
                </div>
                <div
                  class="font-mono text-xs text-gray-500 italic break-words bg-black/30 p-2 rounded"
                >
                  {{ message.privateThought }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-if="chatMessages.length === 0"
        class="absolute inset-0 flex items-center justify-center"
      >
        <div class="text-center space-y-3">
          <MessageSquare :size="48" class="mx-auto text-textMuted opacity-50" />
          <p class="font-mono text-sm text-textMuted">暂无消息</p>
          <p class="font-mono text-xs text-textMuted/60">等待游戏开始...</p>
        </div>
      </div>
    </div>

    <!-- Scanline Overlay -->
    <div
      class="scanline-overlay absolute inset-0 pointer-events-none opacity-5"
    />
  </div>
</template>

<style scoped>
.scroll-container::-webkit-scrollbar {
  width: 6px;
}

.scroll-container::-webkit-scrollbar-track {
  background: #0a0a0a;
  border: 1px solid #1a1a1a;
}

.scroll-container::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 3px;
}

.scroll-container::-webkit-scrollbar-thumb:hover {
  background: #444;
}

.scanline-overlay {
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.1) 2px,
    rgba(0, 0, 0, 0.1) 4px
  );
}

@keyframes typing-cursor {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

.typing-cursor {
  animation: typing-cursor 1s ease-in-out infinite;
}
</style>
