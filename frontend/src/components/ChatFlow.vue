<template>
  <div class="flex-1 flex flex-col h-full">
    <!-- 虚拟滚动容器 -->
    <div
      ref="scrollContainer"
      v-bind="containerProps"
      class="flex-1 overflow-y-auto bg-background cyber-panel"
    >
      <!-- 虚拟滚动包装器 -->
      <div v-bind="wrapperProps" class="relative">
        <!-- 渲染虚拟列表中的消息 -->
        <div
          v-for="item in virtualList"
          :key="item.data.id"
          :data-testid="`chat-bubble-${item.data.id}`"
          class="px-4 py-3"
          :style="item.style"
        >
          <!-- 单个聊天气泡容器 -->
          <div class="flex gap-3 w-full" :class="getBubbleAlignment(item.data)">
            <!-- 左侧区域：头像和角色标识（法官和系统消息不显示头像） -->
            <div v-if="showAvatar(item.data)" class="flex-shrink-0">
              <!-- 头像容器：圆形带角色颜色渐变 -->
              <div
                :data-testid="`chat-avatar-${item.data.senderId}`"
                class="w-10 h-10 rounded-full flex items-center justify-center relative border-2"
                :class="getAvatarClass(item.data)"
              >
                <!-- 头像表情：根据角色显示不同emoji -->
                <span class="font-bold text-white text-sm">
                  {{ getAvatarEmoji(item.data) }}
                </span>
                <!-- 存活状态指示器：绿色表示存活，红色表示狼人 -->
                <div
                  v-if="
                    item.data.senderId > 0 && isPlayerAlive(item.data.senderId)
                  "
                  class="absolute -top-1 -right-1 w-3 h-3 rounded-full"
                  :class="[
                    getPlayerRoleType(item.data.senderId) === 'wolf'
                      ? 'bg-neon-red shadow-glow-red animate-pulse'
                      : 'bg-neon-green shadow-glow-green animate-pulse',
                  ]"
                ></div>
              </div>
              <!-- 角色标识：狼人显示红色标签，平民显示蓝色标签 -->
              <div class="mt-1 flex justify-center">
                <span
                  class="inline-block px-2 py-0.5 text-xs rounded-full font-mono"
                  :class="[
                    getPlayerRoleType(item.data.senderId) === 'wolf'
                      ? 'bg-red-900/30 text-red-300 border border-red-700'
                      : 'bg-blue-900/30 text-blue-300 border border-blue-700',
                  ]"
                >
                  {{
                    getPlayerRoleType(item.data.senderId) === "wolf"
                      ? "狼"
                      : "民"
                  }}
                </span>
              </div>
            </div>

            <!-- 右侧区域：消息内容部分 -->
            <div class="flex-1 min-w-0">
              <!-- 消息头部：发送者名称和时间戳 -->
              <div class="flex items-baseline gap-2 mb-1">
                <!-- 玩家名称：根据角色显示不同颜色 -->
                <span
                  v-if="item.data.senderId >= 0"
                  class="font-mono font-bold text-sm"
                  :class="[
                    getPlayerRoleType(item.data.senderId) === 'wolf'
                      ? 'text-neon-red'
                      : 'text-neon-blue',
                  ]"
                >
                  {{ getPlayerName(item.data.senderId) }}
                </span>
                <!-- 法官消息标识 -->
                <span
                  v-else-if="item.data.senderId === -1"
                  class="font-mono font-bold text-sm text-amber-400"
                >
                  🧑‍⚖️ 法官
                </span>
                <!-- 系统消息标识 -->
                <span
                  v-else-if="item.data.senderId === -2"
                  class="font-mono font-bold text-sm text-neon-yellow"
                >
                  🤖 系统
                </span>

                <!-- 时间戳：精确到秒 -->
                <span class="font-mono text-xs text-textMuted">
                  {{ formatTime(item.data.timestamp) }}
                </span>
              </div>

              <!-- 消息内容气泡：包含文本和发光效果 -->
              <div
                :data-testid="`message-content-${item.data.id}`"
                class="rounded-2xl px-4 py-3 max-w-[80%] relative"
                :class="getMessageBubbleClass(item.data)"
                :style="getMessageBubbleStyle(item.data)"
              >
                <!-- 消息文本：支持换行和长单词自动换行 -->
                <div class="whitespace-pre-wrap break-words font-mono text-sm">
                  {{ item.data.content }}
                </div>

                <!-- 发光边框效果：为消息气泡添加发光效果 -->
                <div
                  class="absolute inset-0 rounded-2xl pointer-events-none"
                  :class="getGlowEffectClass(item.data)"
                ></div>

                <!-- 打字机光标效果：为最新消息添加光标动画 -->
                <div
                  v-if="isLatestMessage(item.data)"
                  class="absolute right-2 bottom-2 w-2 h-4 bg-neon-cyan animate-blink"
                ></div>
              </div>

              <!-- 内心独白折叠面板：按需渲染 -->
              <div v-if="shouldShowThought(item.data)">
                <ThoughtAccordion
                  v-if="
                    item.data.privateThought && item.data.privateThought.trim()
                  "
                  :msg="item.data"
                  :data-testid="`thought-panel-${item.data.senderId}`"
                  class="mt-3"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 空状态：没有消息时显示 -->
        <div
          v-if="chatMessages.length === 0"
          class="text-center p-8 text-textMuted font-mono"
        >
          暂无聊天消息
        </div>
      </div>
    </div>

    <!-- 调试信息面板：仅开发环境显示 -->
    <div
      v-if="debug"
      class="p-3 border-t border-border bg-surface/50 text-xs font-mono text-textMuted"
    >
      调试: chatMessages.length = {{ chatMessages.length }}, virtualList.length
      = {{ virtualList.length }}<br />
      store.chatMessages.length = {{ v2Store.chatMessages.length }}, myViewId =
      {{ v2Store.myViewId }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted } from "vue";
import { useVirtualList } from "@vueuse/core";
import ThoughtAccordion from "@/components/ThoughtAccordion.vue";
import { useGameStore as useV2GameStore } from "@/stores/gameStore";
import type { ChatMessage } from "@/types";
import type { PlayerInfo } from "@/types/v2-types";

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

    if (!msg.isPrivate) {
      return true;
    }

    return false;
  });
});

const {
  list: virtualList,
  containerProps,
  wrapperProps,
} = useVirtualList(chatMessages, {
  itemHeight: 110,
  overscan: 10,
});

const getPlayerName = (playerId: number): string => {
  if (playerId <= 0) return "";

  // 优先从gameState.players中查找
  if (v2Store.gameState?.players) {
    const player = v2Store.gameState.players.find((p) => p.id === playerId);
    if (player?.name) return player.name;
  }

  // 备用方案：从alivePlayers中查找
  const alivePlayer = v2Store.alivePlayers.find((p) => p.id === playerId);
  if (alivePlayer?.name) return alivePlayer.name;

  return `玩家 ${playerId}`;
};

const getPlayerRoleType = (playerId: number): "wolf" | "villager" => {
  if (playerId <= 0) return "villager";

  // 直接从gameState.players中查找，确保有完整的玩家信息
  if (v2Store.gameState?.players) {
    const player = v2Store.gameState.players.find((p) => p.id === playerId);

    if (player) {
      // 调试信息
      if (debug.value) {
        console.log(`[Debug] Found player ${playerId} in gameState:`, player);
      }

      // 优先检查faction字段，然后检查roleType
      if (player.faction === "wolf" || player.roleType === "wolf") {
        return "wolf";
      }
      return "villager";
    }
  }

  // 备用方案：从alivePlayers中查找
  const alivePlayer = v2Store.alivePlayers.find((p) => p.id === playerId);
  if (alivePlayer) {
    if (alivePlayer.faction === "wolf" || alivePlayer.roleType === "wolf") {
      return "wolf";
    }
    return "villager";
  }

  // 如果都没有找到，返回默认值
  if (debug.value) {
    console.warn(`[Debug] Player ${playerId} not found in store`);
  }
  return "villager";
};

const isPlayerAlive = (playerId: number): boolean => {
  if (playerId <= 0) return false;
  const player = v2Store.alivePlayers.find((p) => p.id === playerId);
  return player?.isAlive || false;
};

const getBubbleAlignment = (msg: ChatMessage): string => {
  const myViewId = v2Store.myViewId;

  if (msg.senderId === -1) {
    return "items-center justify-center";
  }

  if (msg.senderId === myViewId) {
    return "items-end justify-end flex-row-reverse";
  }

  return "items-start justify-start";
};

const showAvatar = (msg: ChatMessage): boolean => {
  if (msg.senderId === -1 || msg.senderId === -2) return false;
  return true;
};

const getAvatarClass = (msg: ChatMessage): string => {
  const roleType = getPlayerRoleType(msg.senderId);

  if (roleType === "wolf") {
    return "bg-gradient-to-br from-red-500 to-pink-500 border-red-400";
  } else {
    return "bg-gradient-to-br from-blue-500 to-cyan-500 border-blue-400";
  }
};

const getAvatarEmoji = (msg: ChatMessage): string => {
  if (msg.senderId === -1) return "🧑‍⚖️";
  if (msg.senderId === -2) return "🤖";

  const roleType = getPlayerRoleType(msg.senderId);
  return roleType === "wolf" ? "🐺" : "👤";
};

const getMessageBubbleClass = (msg: ChatMessage): string => {
  const myViewId = v2Store.myViewId;

  if (msg.senderId === -1) {
    return "bg-gray-900/60 border border-amber-500/50 text-white";
  }

  if (msg.senderId === -2) {
    return "bg-surface border border-border text-text";
  }

  if (msg.senderId === myViewId) {
    return "bg-neon-blue/15 border border-neon-blue text-white";
  }

  const roleType = getPlayerRoleType(msg.senderId);
  if (roleType === "wolf") {
    return "bg-red-900/25 border border-red-700/40 text-red-100";
  } else {
    return "bg-blue-900/25 border border-blue-700/40 text-blue-100";
  }
};

const getMessageBubbleStyle = (msg: ChatMessage): Record<string, string> => {
  const myViewId = v2Store.myViewId;

  if (msg.senderId === -1) {
    return {
      "max-width": "90%",
      "margin-left": "auto",
      "margin-right": "auto",
    };
  }

  if (msg.senderId === myViewId) {
    return {
      "margin-left": "auto",
    };
  }

  return {
    "margin-right": "auto",
  };
};

const getGlowEffectClass = (msg: ChatMessage): string => {
  const myViewId = v2Store.myViewId;

  if (msg.senderId === -1) {
    return "shadow-[0_0_15px_rgba(245,158,11,0.5)]";
  }

  if (msg.senderId === myViewId) {
    return "shadow-[0_0_20px_rgba(34,211,238,0.6)]";
  }

  const roleType = getPlayerRoleType(msg.senderId);
  if (roleType === "wolf") {
    return "shadow-[0_0_15px_rgba(239,68,68,0.4)]";
  } else {
    return "shadow-[0_0_15px_rgba(59,130,246,0.4)]";
  }
};

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
};

const shouldShowThought = (msg: ChatMessage): boolean => {
  const myViewId = v2Store.myViewId;

  if (myViewId === 0) return true;

  if (msg.senderId === myViewId) return true;

  return false;
};

const isLatestMessage = (msg: ChatMessage): boolean => {
  if (chatMessages.value.length === 0) return false;
  const lastMessage = chatMessages.value[chatMessages.value.length - 1];
  return msg.id === lastMessage.id;
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
  console.log("ChatFlow mounted");
  console.log("Initial chatMessages:", chatMessages.value);
  console.log("Initial gameState:", v2Store.gameState);
});

// 监听chatMessages变化
watch(
  chatMessages,
  (newMessages) => {
    if (debug.value) {
      console.log("chatMessages updated:", newMessages.length, "messages");
      if (newMessages.length > 0) {
        console.log("First message:", newMessages[0]);
      }
    }
  },
  { immediate: true },
);
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
