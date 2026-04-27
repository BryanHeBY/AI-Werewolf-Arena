<template>
  <div class="flex-1 flex flex-col h-full">
    <div
      ref="scrollContainer"
      class="flex-1 overflow-y-auto bg-background cyber-panel"
    >
      <div class="relative">
        <div
          v-for="item in chatMessages"
          :key="item.id"
          :data-testid="`chat-bubble-${item.id}`"
          class="px-4 py-3"
        >
          <div class="flex gap-3" :class="getBubbleAlignment(item)">
            <div v-if="showAvatar(item)" class="flex-shrink-0">
              <div
                :data-testid="`chat-avatar-${item.senderId}`"
                class="w-10 h-10 rounded-full flex items-center justify-center relative border-2"
                :class="getAvatarClass(item)"
              >
                <span class="font-bold text-white text-sm">
                  {{ getAvatarEmoji(item) }}
                </span>
                <div
                  v-if="item.senderId > 0 && isPlayerAlive(item.senderId)"
                  class="absolute -top-1 -right-1 w-3 h-3 rounded-full"
                  :class="[
                    getPlayerRoleType(item.senderId) === 'wolf'
                      ? 'bg-neon-red shadow-glow-red animate-pulse'
                      : 'bg-neon-green shadow-glow-green animate-pulse',
                  ]"
                />
              </div>
              <div class="mt-1 flex justify-center">
                <span
                  class="inline-block px-2 py-0.5 text-xs rounded-full font-mono"
                  :class="[
                    getPlayerRoleType(item.senderId) === 'wolf'
                      ? 'bg-red-900/30 text-red-300 border border-red-700'
                      : 'bg-blue-900/30 text-blue-300 border border-blue-700',
                  ]"
                >
                  {{ getPlayerRoleType(item.senderId) === "wolf" ? "狼" : "民" }}
                </span>
              </div>
            </div>

            <div class="flex-grow flex-shrink">
              <div class="flex items-baseline gap-2 mb-1">
                <span
                  v-if="item.senderId >= 0"
                  class="font-mono font-bold text-sm"
                  :class="[
                    getPlayerRoleType(item.senderId) === 'wolf'
                      ? 'text-neon-red'
                      : 'text-neon-blue',
                  ]"
                >
                  {{ getPlayerName(item.senderId) }}
                </span>
                <span
                  v-else-if="item.senderId === -1"
                  class="font-mono font-bold text-sm text-amber-400"
                >
                  🧑‍⚖️ 法官
                </span>
                <span
                  v-else-if="item.senderId === -2"
                  class="font-mono font-bold text-sm text-neon-yellow"
                >
                  🤖 系统
                </span>

                <span class="font-mono text-xs text-textMuted">
                  {{ formatTime(item.timestamp) }}
                </span>
              </div>

              <div
                :data-testid="`message-content-${item.id}`"
                class="rounded-2xl px-4 py-3 inline-block relative"
                :class="getMessageBubbleClass(item)"
                :style="getMessageBubbleStyle(item)"
              >
                <div v-if="shouldShowThought(item)">
                  <ThoughtAccordion
                    v-if="item.privateThought && item.privateThought.trim()"
                    :msg="item"
                    :data-testid="`thought-panel-${item.senderId}`"
                    class="mb-3"
                  />
                </div>

                <div class="whitespace-pre-wrap break-words font-mono text-sm">
                  {{ item.content }}
                </div>

                <div
                  class="absolute inset-0 rounded-2xl pointer-events-none"
                  :class="getGlowEffectClass(item)"
                />

                <div
                  v-if="isLatestMessage(item)"
                  class="absolute right-2 bottom-2 w-2 h-4 bg-neon-cyan animate-blink"
                />
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="chatMessages.length === 0"
          class="text-center p-8 text-textMuted font-mono"
        >
          暂无聊天消息
        </div>
      </div>
    </div>

    <div
      v-if="debug"
      class="p-3 border-t border-border bg-surface/50 text-xs font-mono text-textMuted"
    >
      调试: chatMessages.length = {{ chatMessages.length }}<br />
      store.chatMessages.length = {{ v2Store.chatMessages.length }}, myViewId =
      {{ v2Store.myViewId }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted } from "vue";
import ThoughtAccordion from "@/components/ThoughtAccordion.vue";
import { useGameStore as useV2GameStore } from "@/stores/gameStore";
import type { ChatMessage } from "@/types";

const v2Store = useV2GameStore();
const debug = ref(true);
const scrollContainer = ref<HTMLElement | null>(null);

const chatMessages = computed(() => {
  const myViewId = v2Store.myViewId;
  const allMessages = v2Store.chatMessages;

  if (myViewId === 0) {
    return allMessages;
  }

  return allMessages.filter((msg) => {
    if (msg.senderId === -1 || msg.senderId === -2) {
      return true;
    }
    if (msg.senderId === myViewId) {
      return true;
    }
    return !msg.isPrivate;
  });
});

const findPlayer = (playerId: number) => {
  return (
    v2Store.gameState?.players.find((p) => p.id === playerId) ??
    v2Store.alivePlayers.find((p) => p.id === playerId) ??
    v2Store.deadPlayers.find((p) => p.id === playerId)
  );
};

const getPlayerName = (playerId: number): string => {
  if (playerId <= 0) return "";
  return findPlayer(playerId)?.name ?? `玩家 ${playerId}`;
};

const getPlayerRoleType = (playerId: number): "wolf" | "villager" => {
  if (playerId <= 0) return "villager";
  const player = findPlayer(playerId);
  if (player?.faction === "wolf" || player?.roleType === "wolf") {
    return "wolf";
  }
  return "villager";
};

const isPlayerAlive = (playerId: number): boolean => {
  if (playerId <= 0) return false;
  return findPlayer(playerId)?.isAlive ?? false;
};

const getBubbleAlignment = (msg: ChatMessage): string => {
  if (msg.senderId === -1) return "items-center justify-center";
  if (msg.senderId === v2Store.myViewId) {
    return "items-end justify-end flex-row-reverse";
  }
  return "items-start justify-start";
};

const showAvatar = (msg: ChatMessage): boolean => {
  return msg.senderId !== -1 && msg.senderId !== -2;
};

const getAvatarClass = (msg: ChatMessage): string => {
  return getPlayerRoleType(msg.senderId) === "wolf"
    ? "bg-gradient-to-br from-red-500 to-pink-500 border-red-400"
    : "bg-gradient-to-br from-blue-500 to-cyan-500 border-blue-400";
};

const getAvatarEmoji = (msg: ChatMessage): string => {
  if (msg.senderId === -1) return "🧑‍⚖️";
  if (msg.senderId === -2) return "🤖";
  return getPlayerRoleType(msg.senderId) === "wolf" ? "🐺" : "👤";
};

const getMessageBubbleClass = (msg: ChatMessage): string => {
  if (msg.senderId === -1) {
    return "bg-gray-900/60 border border-amber-500/50 text-white";
  }
  if (msg.senderId === -2) {
    return "bg-surface border border-border text-text";
  }
  if (msg.senderId === v2Store.myViewId) {
    return "bg-neon-blue/15 border border-neon-blue text-white";
  }
  return getPlayerRoleType(msg.senderId) === "wolf"
    ? "bg-red-900/25 border border-red-700/40 text-red-100"
    : "bg-blue-900/25 border border-blue-700/40 text-blue-100";
};

const getMessageBubbleStyle = (msg: ChatMessage): Record<string, string> => {
  if (msg.senderId === -1) {
    return {
      "max-width": "fit-content",
      "margin-left": "auto",
      "margin-right": "auto",
      display: "block",
    };
  }
  if (msg.senderId === v2Store.myViewId) {
    return {
      "max-width": "fit-content",
      "margin-left": "auto",
      display: "block",
    };
  }
  return {
    "max-width": "fit-content",
    "margin-right": "auto",
    display: "block",
  };
};

const getGlowEffectClass = (msg: ChatMessage): string => {
  if (msg.senderId === -1) {
    return "shadow-[0_0_15px_rgba(245,158,11,0.5)]";
  }
  if (msg.senderId === v2Store.myViewId) {
    return "shadow-[0_0_20px_rgba(34,211,238,0.6)]";
  }
  return getPlayerRoleType(msg.senderId) === "wolf"
    ? "shadow-[0_0_15px_rgba(239,68,68,0.4)]"
    : "shadow-[0_0_15px_rgba(59,130,246,0.4)]";
};

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
};

const shouldShowThought = (msg: ChatMessage): boolean => {
  if (v2Store.myViewId === 0) return true;
  return msg.senderId === v2Store.myViewId;
};

const isLatestMessage = (msg: ChatMessage): boolean => {
  const lastMessage = chatMessages.value[chatMessages.value.length - 1];
  return lastMessage ? msg.id === lastMessage.id : false;
};

watch(
  () => chatMessages.value.length,
  () => {
    nextTick(() => {
      if (scrollContainer.value) {
        scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
      }
    });
  },
  { flush: "post" },
);

onMounted(() => {
  if (debug.value) {
    console.log("ChatFlow mounted");
  }
});
</script>

<style scoped>
.cyber-panel {
  position: relative;
  overflow: hidden;
}

.cyber-panel::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    var(--neon-blue) 20%,
    var(--neon-blue) 80%,
    transparent
  );
  animation: scanline 8s linear infinite;
}

@keyframes scanline {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(100vh);
  }
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

.animate-blink {
  animation: blink 1s infinite;
}
</style>
