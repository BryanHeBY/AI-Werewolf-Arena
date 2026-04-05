<template>
  <div class="flex-1 flex flex-col h-full">
    <!-- 测试：临时使用普通滚动 -->
    <div class="flex-1 overflow-y-auto p-4">
      <!-- 调试信息 -->
      <div
        class="p-3 mb-4 bg-red-900/20 border border-red-700/30 text-red-100 text-sm font-mono"
      >
        调试: chatMessages.length = {{ chatMessages.length }}
      </div>

      <!-- 普通列表渲染 -->
      <div
        v-for="message in chatMessages"
        :key="message.id"
        :data-testid="`chat-bubble-${message.id}`"
        class="mb-4 p-4 bg-surface border border-border rounded-lg"
      >
        <div class="flex items-center gap-3 mb-2">
          <div
            class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center"
          >
            <span class="text-white text-sm">👤</span>
          </div>
          <div>
            <div class="font-bold text-white">玩家 {{ message.senderId }}</div>
            <div class="text-xs text-gray-400">
              {{ new Date(message.timestamp).toLocaleTimeString() }}
            </div>
          </div>
        </div>
        <div class="text-white font-mono">
          {{ message.content }}
        </div>
        <div
          v-if="message.privateThought"
          class="mt-2 p-2 bg-yellow-900/20 border border-yellow-700/30 text-yellow-100 text-sm"
        >
          内心独白: {{ message.privateThought }}
        </div>
      </div>

      <div
        v-if="chatMessages.length === 0"
        class="text-center text-gray-500 p-8"
      >
        暂无聊天消息
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useGameStore as useV2GameStore } from "@/stores/gameStore";

// 获取V2游戏状态存储实例
const v2Store = useV2GameStore();

// 计算属性：根据当前视角过滤聊天消息
const chatMessages = computed(() => {
  const myViewId = v2Store.myViewId;
  const allMessages = v2Store.chatMessages;

  if (myViewId === 0) {
    // 上帝视角：显示所有消息
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

    return false;
  });
});
</script>
