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
                />
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
                />

                <!-- 打字机光标效果：为最新消息添加光标动画 -->
                <div
                  v-if="isLatestMessage(item.data)"
                  class="absolute right-2 bottom-2 w-2 h-4 bg-neon-cyan animate-blink"
                />
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
      = {{ virtualList.length }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted } from "vue";
import { useVirtualList } from "@vueuse/core";
import ThoughtAccordion from "@/components/ThoughtAccordion.vue";
import { useGameStore as useV2GameStore } from "@/stores/gameStore";
import type { ChatMessage } from "@/types";

// 获取V2游戏状态存储实例
const v2Store = useV2GameStore();

// 响应式引用
const debug = ref(true);
const scrollContainer = ref<HTMLElement | null>(null);

// 计算属性：根据当前视角过滤聊天消息
const chatMessages = computed(() => {
  const myViewId = v2Store.myViewId;
  const allMessages = v2Store.chatMessages;

  if (myViewId === 0) {
    // 上帝视角：显示所有消息，包括私聊和内心独白
    return allMessages;
  }

  // 玩家视角：根据角色和消息类型过滤
  return allMessages.filter((msg) => {
    // 系统消息和法官消息总是可见
    if (msg.senderId === -1 || msg.senderId === -2) {
      return true;
    }

    // 自己发送的消息总是可见
    if (msg.senderId === myViewId) {
      return true;
    }

    // 他人发送的公开消息可见
    if (!msg.isPrivate) {
      return true;
    }

    // 他人的私聊消息不可见（除非是上帝视角）
    return false;
  });
});

// 计算虚拟列表：使用VueUse的useVirtualList优化大量消息渲染
const {
  list: virtualList,
  containerProps,
  wrapperProps,
} = useVirtualList(chatMessages, {
  itemHeight: 110, // 预估每个消息的高度（像素）
  overscan: 10, // 上下预渲染的项目数，确保滚动平滑
});

// 获取玩家名称
const getPlayerName = (playerId: number): string => {
  if (playerId <= 0) return "";
  const player = v2Store.alivePlayers.find((p) => p.id === playerId);
  return player?.name || `玩家 ${playerId}`;
};

// 获取玩家角色类型
const getPlayerRoleType = (playerId: number): "wolf" | "villager" => {
  if (playerId <= 0) return "villager";
  const player = v2Store.alivePlayers.find((p) => p.id === playerId);
  // 注意：PublicPlayer接口没有roleType属性，这里使用默认值
  // 在实际应用中，应该从gameState中获取角色信息
  return "villager"; // 默认返回村民
};

// 检查玩家是否存活
const isPlayerAlive = (playerId: number): boolean => {
  if (playerId <= 0) return false;
  const player = v2Store.alivePlayers.find((p) => p.id === playerId);
  return player?.isAlive || false;
};

// 获取气泡对齐方式：根据发送者和当前视角确定消息对齐方式
const getBubbleAlignment = (msg: ChatMessage): string => {
  const myViewId = v2Store.myViewId;

  if (msg.senderId === -1) {
    // 法官消息：居中显示，突出重要性
    return "items-center justify-center";
  }

  if (msg.senderId === myViewId) {
    // 自己发送的消息：靠右显示，类似主流聊天应用
    return "items-end justify-end flex-row-reverse";
  }

  // 他人发送的消息：靠左显示
  return "items-start justify-start";
};

// 是否显示头像：法官和系统消息不显示头像
const showAvatar = (msg: ChatMessage): boolean => {
  // 法官和系统消息不显示头像
  if (msg.senderId === -1 || msg.senderId === -2) return false;
  return true;
};

// 获取头像样式类：根据角色类型设置渐变背景色
const getAvatarClass = (msg: ChatMessage): string => {
  const roleType = getPlayerRoleType(msg.senderId);

  if (roleType === "wolf") {
    // 狼人头像：红色到粉色的渐变
    return "bg-gradient-to-br from-red-500 to-pink-500 border-red-400";
  } else {
    // 平民头像：蓝色到青色的渐变
    return "bg-gradient-to-br from-blue-500 to-cyan-500 border-blue-400";
  }
};

// 获取头像表情：使用emoji表示不同角色
const getAvatarEmoji = (msg: ChatMessage): string => {
  if (msg.senderId === -1) return "🧑‍⚖️"; // 法官
  if (msg.senderId === -2) return "🤖"; // 系统

  const roleType = getPlayerRoleType(msg.senderId);
  return roleType === "wolf" ? "🐺" : "👤"; // 狼人 vs 平民
};

// 获取消息气泡样式类：根据发送者和角色设置气泡样式
const getMessageBubbleClass = (msg: ChatMessage): string => {
  const myViewId = v2Store.myViewId;

  if (msg.senderId === -1) {
    // 法官消息：灰色背景，琥珀色边框，突出权威性
    return "bg-gray-900/60 border border-amber-500/50 text-white";
  }

  if (msg.senderId === -2) {
    // 系统消息：中性色，用于系统通知
    return "bg-surface border border-border text-text";
  }

  if (msg.senderId === myViewId) {
    // 自己发送的消息：蓝色荧光效果，强调用户自己的消息
    return "bg-neon-blue/15 border border-neon-blue text-white";
  }

  // 他人发送的消息：根据角色设置不同颜色
  const roleType = getPlayerRoleType(msg.senderId);
  if (roleType === "wolf") {
    // 狼人消息：红色系，暗示危险
    return "bg-red-900/25 border border-red-700/40 text-red-100";
  } else {
    // 平民消息：蓝色系，中立安全
    return "bg-blue-900/25 border border-blue-700/40 text-blue-100";
  }
};

// 获取消息气泡样式：控制气泡的位置和最大宽度
const getMessageBubbleStyle = (msg: ChatMessage): Record<string, string> => {
  const myViewId = v2Store.myViewId;

  if (msg.senderId === -1) {
    // 法官消息：居中显示，宽度较大
    return {
      "max-width": "90%",
      "margin-left": "auto",
      "margin-right": "auto",
    };
  }

  if (msg.senderId === myViewId) {
    // 自己发送的消息：靠右对齐
    return {
      "margin-left": "auto",
    };
  }

  // 他人发送的消息：靠左对齐
  return {
    "margin-right": "auto",
  };
};

// 获取发光效果类：为消息气泡添加发光效果，增强视觉层次
const getGlowEffectClass = (msg: ChatMessage): string => {
  const myViewId = v2Store.myViewId;

  if (msg.senderId === -1) {
    // 法官消息：琥珀色发光，强调重要性
    return "shadow-[0_0_15px_rgba(245,158,11,0.5)]";
  }

  if (msg.senderId === myViewId) {
    // 自己发送的消息：蓝色发光，突出用户自己的消息
    return "shadow-[0_0_20px_rgba(34,211,238,0.6)]";
  }

  // 他人发送的消息：根据角色设置发光颜色
  const roleType = getPlayerRoleType(msg.senderId);
  if (roleType === "wolf") {
    // 狼人消息：红色发光，暗示危险
    return "shadow-[0_0_15px_rgba(239,68,68,0.4)]";
  } else {
    // 平民消息：蓝色发光，中性
    return "shadow-[0_0_15px_rgba(59,130,246,0.4)]";
  }
};

// 格式化时间：将时间戳转换为易读的HH:MM:SS格式
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
};

// 是否应该显示内心独白：控制内心独白的可见性
const shouldShowThought = (msg: ChatMessage): boolean => {
  const myViewId = v2Store.myViewId;

  // 上帝视角：显示所有内心独白（用于调试和观察AI思考）
  if (myViewId === 0) return true;

  // 自己发送的消息：显示自己的内心独白
  if (msg.senderId === myViewId) return true;

  // 其他情况：不显示内心独白（保护AI思考隐私）
  return false;
};

// 检查是否是最新消息（用于显示光标效果）
const isLatestMessage = (msg: ChatMessage): boolean => {
  if (chatMessages.value.length === 0) return false;
  const lastMessage = chatMessages.value[chatMessages.value.length - 1];
  return msg.id === lastMessage.id;
};

// 监听消息变化，自动滚动到底部：确保新消息始终可见
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

// 组件生命周期：挂载时
onMounted(() => {
  console.log("ChatFlow mounted");
});
</script>

<style scoped>
/* 赛博朋克风格面板 */
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

/* 打字机光标效果 */
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

/* 荧光效果增强 */
.shadow-glow-red {
  box-shadow:
    0 0 20px rgba(255, 0, 102, 0.5),
    0 0 40px rgba(255, 0, 102, 0.3);
}

.shadow-glow-blue {
  box-shadow:
    0 0 20px rgba(0, 243, 255, 0.5),
    0 0 40px rgba(0, 243, 255, 0.3);
}

.shadow-glow-purple {
  box-shadow:
    0 0 20px rgba(157, 0, 255, 0.5),
    0 0 40px rgba(157, 0, 255, 0.3);
}
</style>
