<template>
  <div class="flex-1 flex flex-col h-full">
    <!-- V2: 虚拟滚动容器 - 使用虚拟滚动优化大量消息的性能 -->
    <div ref="scrollContainer" class="flex-1 overflow-hidden relative">
      <!-- 虚拟列表容器，高度动态计算，为所有消息提供总高度 -->
      <div
        :style="{
          height: `${virtualListTotalHeight}px`,
          position: 'relative',
        }"
        class="w-full"
      >
        <!-- 虚拟列表渲染：仅渲染可见区域的聊天消息，提升性能 -->
        <div
          v-for="item in virtualList"
          :key="item.data.id"
          :data-testid="`chat-bubble-${item.data.id}`"
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${item.start}px)`,
          }"
          class="px-4 py-2"
        >
          <!-- 单个聊天气泡：采用QQ风格布局，包含头像和消息内容 -->
          <div class="flex gap-3 w-full" :class="getBubbleAlignment(item.data)">
            <!-- 左侧区域：头像和角色标识 -->
            <!-- 法官和系统消息不显示头像，玩家消息显示带角色标识的头像 -->
            <div v-if="showAvatar(item.data)" class="flex-shrink-0">
              <!-- 头像容器：圆形头像带边框和角色颜色 -->
              <div
                :data-testid="`chat-avatar-${item.data.senderId}`"
                class="w-10 h-10 rounded-full flex items-center justify-center relative border-2"
                :class="getAvatarClass(item.data)"
              >
                <!-- 头像表情：狼人用🐺，平民用👤，法官用🧑‍⚖️，系统用🤖 -->
                <span class="font-bold text-white text-sm">
                  {{ getAvatarEmoji(item.data) }}
                </span>
                <!-- 存活状态指示器：绿色表示存活，红色表示狼人，带脉冲动画 -->
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
              <!-- 角色徽章：显示"狼"或"民"，颜色对应角色 -->
              <div
                v-if="item.data.senderId >= 0"
                :data-testid="`role-badge-${item.data.senderId}`"
                class="mt-1 text-center"
              >
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
              <!-- 消息头部：发送者名称、角色标识和时间戳 -->
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
                <!-- 法官消息：显示法官标识 -->
                <span
                  v-else-if="item.data.senderId === -1"
                  class="font-mono font-bold text-sm text-neon-cyan"
                >
                  🧑‍⚖️ 法官
                </span>
                <!-- 系统消息：显示系统标识 -->
                <span
                  v-else-if="item.data.senderId === -2"
                  class="font-mono font-bold text-sm text-neon-yellow"
                >
                  🤖 系统
                </span>

                <!-- 时间戳：显示消息发送的精确时间 -->
                <span class="font-mono text-xs text-textMuted">
                  {{ formatTime(item.data.timestamp) }}
                </span>
              </div>

              <!-- 消息内容气泡：包含文本内容和发光效果 -->
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

                <!-- 发光边框效果：为消息气泡添加发光效果，增强视觉反馈 -->
                <div
                  class="absolute inset-0 rounded-2xl pointer-events-none"
                  :class="getGlowEffectClass(item.data)"
                />

                <!-- AI 内心独白折叠面板：显示AI的思考过程，仅特定视角可见 -->
                <ThoughtAccordion
                  v-if="
                    item.data.privateThought &&
                    item.data.privateThought.trim() &&
                    shouldShowThought(item.data)
                  "
                  :thought="item.data.privateThought"
                  :sender-id="item.data.senderId"
                  :data-testid="`thought-panel-${item.data.senderId}`"
                  class="mt-3"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 调试信息面板：仅开发环境显示，用于调试虚拟列表性能 -->
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
// Vue 3 Composition API 导入
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from "vue";
// VueUse 虚拟列表组件，用于优化大量数据的渲染性能
import { useVirtualList } from "@vueuse/core";
// 内心独白折叠面板组件
import ThoughtAccordion from "@/components/ThoughtAccordion.vue";
// 游戏状态管理
import { useGameStore as useV2GameStore } from "@/stores/gameStore";
// TypeScript 类型定义
import type { ChatMessage } from "@/types";

// 获取V2游戏状态存储实例
const v2Store = useV2GameStore();

// 响应式引用
// 滚动容器引用，用于控制自动滚动
const scrollContainer = ref<HTMLElement | null>(null);
// 调试模式开关
const debug = ref(false);

// 计算属性：根据当前视角过滤聊天消息
// 核心业务逻辑：实现不同视角下的消息可见性控制
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
// 虚拟列表原理：只渲染可见区域的消息，提升性能
const {
  list: virtualList,
  containerProps,
  wrapperProps,
} = useVirtualList(chatMessages, {
  itemHeight: 100, // 预估每个消息的高度（像素）
  overscan: 10, // 上下预渲染的项目数，确保滚动平滑
});

// 计算虚拟列表总高度：用于设置虚拟列表容器的总高度
const virtualListTotalHeight = computed(() => {
  // 简单估算：项目数 * 预估高度，实际高度由浏览器计算
  return chatMessages.value.length * 100;
});

// 获取玩家名称
// @param playerId - 玩家ID
// @returns 玩家名称或默认名称
const getPlayerName = (playerId: number): string => {
  if (playerId <= 0) return "";
  const player = v2Store.alivePlayers.find((p) => p.id === playerId);
  return player?.name || `玩家 ${playerId}`;
};

// 获取玩家角色类型
// @param playerId - 玩家ID
// @returns "wolf"（狼人）或"villager"（平民）
const getPlayerRoleType = (playerId: number): "wolf" | "villager" => {
  if (playerId <= 0) return "villager";
  const player = v2Store.alivePlayers.find((p) => p.id === playerId);
  return player?.roleType || "villager";
};

// 检查玩家是否存活
// @param playerId - 玩家ID
// @returns 玩家是否存活
const isPlayerAlive = (playerId: number): boolean => {
  if (playerId <= 0) return false;
  const player = v2Store.alivePlayers.find((p) => p.id === playerId);
  return player?.isAlive || false;
};

// 获取气泡对齐方式：根据发送者和当前视角确定消息对齐方式
// @param msg - 聊天消息对象
// @returns Tailwind CSS对齐类名
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
// @param msg - 聊天消息对象
// @returns 是否显示头像
const showAvatar = (msg: ChatMessage): boolean => {
  // 法官和系统消息不显示头像
  if (msg.senderId === -1 || msg.senderId === -2) return false;
  return true;
};

// 获取头像样式类：根据角色类型设置渐变背景色
// @param msg - 聊天消息对象
// @returns Tailwind CSS类名
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
// @param msg - 聊天消息对象
// @returns 表情符号字符串
const getAvatarEmoji = (msg: ChatMessage): string => {
  if (msg.senderId === -1) return "🧑‍⚖️"; // 法官
  if (msg.senderId === -2) return "🤖"; // 系统

  const roleType = getPlayerRoleType(msg.senderId);
  return roleType === "wolf" ? "🐺" : "👤"; // 狼人 vs 平民
};

// 获取消息气泡样式类：根据发送者和角色设置气泡样式
// @param msg - 聊天消息对象
// @returns Tailwind CSS类名
const getMessageBubbleClass = (msg: ChatMessage): string => {
  const myViewId = v2Store.myViewId;

  if (msg.senderId === -1) {
    // 法官消息：灰色背景，琥珀色边框，突出权威性
    return "bg-surface border border-amber-500/30 text-text";
  }

  if (msg.senderId === -2) {
    // 系统消息：中性色，用于系统通知
    return "bg-surface border border-border text-text";
  }

  if (msg.senderId === myViewId) {
    // 自己发送的消息：蓝色荧光效果，强调用户自己的消息
    return "bg-neon-blue/10 border border-neon-blue text-white";
  }

  // 他人发送的消息：根据角色设置不同颜色
  const roleType = getPlayerRoleType(msg.senderId);
  if (roleType === "wolf") {
    // 狼人消息：红色系，暗示危险
    return "bg-red-900/20 border border-red-700/30 text-red-100";
  } else {
    // 平民消息：蓝色系，中立安全
    return "bg-blue-900/20 border border-blue-700/30 text-blue-100";
  }
};

// 获取消息气泡样式：控制气泡的位置和最大宽度
// @param msg - 聊天消息对象
// @returns CSS样式对象
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
// @param msg - 聊天消息对象
// @returns Tailwind CSS阴影类名
const getGlowEffectClass = (msg: ChatMessage): string => {
  const myViewId = v2Store.myViewId;

  if (msg.senderId === -1) {
    // 法官消息：琥珀色发光，强调重要性
    return "shadow-[0_0_15px_rgba(245,158,11,0.5)]";
  }

  if (msg.senderId === myViewId) {
    // 自己发送的消息：蓝色发光，突出用户自己的消息
    return "shadow-[0_0_15px_rgba(34,211,238,0.5)]";
  }

  // 他人发送的消息：根据角色设置发光颜色
  const roleType = getPlayerRoleType(msg.senderId);
  if (roleType === "wolf") {
    // 狼人消息：红色发光，暗示危险
    return "shadow-[0_0_15px_rgba(239,68,68,0.3)]";
  } else {
    // 平民消息：蓝色发光，中性
    return "shadow-[0_0_15px_rgba(59,130,246,0.3)]";
  }
};

// 格式化时间：将时间戳转换为易读的HH:MM:SS格式
// @param timestamp - Unix时间戳（毫秒）
// @returns 格式化后的时间字符串
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
};

// 是否应该显示内心独白：控制内心独白的可见性
// 核心业务逻辑：只有上帝视角和自己能看到自己的内心独白
// @param msg - 聊天消息对象
// @returns 是否显示内心独白
const shouldShowThought = (msg: ChatMessage): boolean => {
  const myViewId = v2Store.myViewId;

  // 上帝视角：显示所有内心独白（用于调试和观察AI思考）
  if (myViewId === 0) return true;

  // 自己发送的消息：显示自己的内心独白
  if (msg.senderId === myViewId) return true;

  // 其他情况：不显示内心独白（保护AI思考隐私）
  return false;
};

// 监听消息变化，自动滚动到底部：确保新消息始终可见
// 使用nextTick确保DOM更新完成后再滚动
// { flush: "post" } 确保在DOM更新后执行
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

// 组件生命周期：卸载时
onUnmounted(() => {
  console.log("ChatFlow unmounted");
});
</script>
