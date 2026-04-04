<template>
  <div class="h-screen flex flex-col bg-background">
    <div class="p-4 border-b border-border">
      <h1 class="text-neon-cyan font-mono text-xl">ChatFlow 演示</h1>
      <p class="text-textMuted font-mono text-sm">测试虚拟滚动聊天组件</p>
    </div>

    <div class="flex-1 flex">
      <!-- 左侧控制面板 -->
      <div class="w-80 border-r border-border p-4 space-y-4">
        <div>
          <h3 class="font-mono text-neon-blue mb-2">视角设置</h3>
          <div class="space-y-2">
            <button
              v-for="viewId in [0, 1, 2, 3]"
              :key="viewId"
              @click="setViewId(viewId)"
              :class="[
                'w-full py-2 font-mono text-sm border rounded transition-all',
                currentViewId === viewId
                  ? 'bg-neon-blue/10 border-neon-blue text-neon-blue'
                  : 'bg-surface border-border text-text hover:bg-surfaceHover',
              ]"
            >
              P{{ viewId }}
              {{ viewId === 0 ? "(上帝视角)" : `(玩家${viewId})` }}
            </button>
          </div>
        </div>

        <div>
          <h3 class="font-mono text-neon-purple mb-2">消息类型</h3>
          <div class="space-y-2">
            <button
              v-for="type in ['system', 'player', 'judge']"
              :key="type"
              @click="addMessage(type)"
              :class="[
                'w-full py-2 font-mono text-sm border rounded transition-all',
                type === 'system'
                  ? 'border-neon-red text-neon-red hover:bg-neon-red/5'
                  : type === 'judge'
                    ? 'border-neon-red text-neon-red hover:bg-neon-red/5'
                    : type === 'player' && currentViewId === 1
                      ? 'border-neon-blue text-neon-blue hover:bg-neon-blue/5'
                      : 'border-neon-purple text-neon-purple hover:bg-neon-purple/5',
              ]"
            >
              添加
              {{
                type === "system"
                  ? "系统消息"
                  : type === "judge"
                    ? "法官消息"
                    : "玩家消息"
              }}
            </button>
          </div>
        </div>

        <div>
          <h3 class="font-mono text-neon-cyan mb-2">统计数据</h3>
          <div class="font-mono text-xs space-y-1 text-textMuted">
            <div>总消息数: {{ mockMessages.length }}</div>
            <div>
              自己消息:
              {{
                mockMessages.filter((m) => m.playerId === currentViewId).length
              }}
            </div>
            <div>
              他人消息:
              {{
                mockMessages.filter(
                  (m) =>
                    m.playerId &&
                    m.playerId !== currentViewId &&
                    m.playerId !== -1,
                ).length
              }}
            </div>
            <div>
              法官/系统:
              {{
                mockMessages.filter((m) => !m.playerId || m.playerId === -1)
                  .length
              }}
            </div>
            <div>
              含内心独白:
              {{ mockMessages.filter((m) => m.privateThought).length }}
            </div>
          </div>
        </div>

        <button
          @click="clearMessages"
          class="w-full py-2 font-mono text-sm border border-neon-red/50 text-neon-red rounded hover:bg-neon-red/5 transition-all"
        >
          清空所有消息
        </button>
      </div>

      <!-- 右侧 ChatFlow -->
      <div class="flex-1 p-4">
        <ChatFlow
          :test-mode="true"
          :messages="mockMessages"
          :my-view-id="currentViewId"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import ChatFlow from "./ChatFlow.vue";
import type { ChatMessage } from "@/types/v2-types";

const currentViewId = ref(0); // 0 = 上帝视角
let messageId = 0;

const mockMessages = ref<ChatMessage[]>([
  {
    id: String(messageId++),
    type: "system",
    playerName: "系统",
    playerId: -1,
    content: "游戏开始！欢迎来到狼人杀竞技场。",
    timestamp: Date.now() - 60000,
  },
  {
    id: String(messageId++),
    type: "speak",
    playerName: "玩家1",
    playerId: 1,
    content: "大家好，我是1号玩家，我是好人！",
    timestamp: Date.now() - 45000,
  },
  {
    id: String(messageId++),
    type: "speak",
    playerName: "玩家2",
    playerId: 2,
    content: "我觉得1号玩家发言有点紧张，可能是狼人。",
    timestamp: Date.now() - 40000,
    privateThought: "实际上我是狼人，1号看起来像预言家，得小心他。",
  },
  {
    id: String(messageId++),
    type: "speak",
    playerName: "玩家3",
    playerId: 3,
    content: "晚上我查验了2号，他是狼人！",
    timestamp: Date.now() - 35000,
    privateThought: "我是预言家，2号确实是狼人。",
  },
  {
    id: String(messageId++),
    type: "system",
    playerName: "法官",
    playerId: -1,
    content: "天亮了！昨晚是个平安夜。",
    timestamp: Date.now() - 30000,
  },
  {
    id: String(messageId++),
    type: "speak",
    playerName: "玩家1",
    playerId: 1,
    content: "我才是预言家，3号是假的！",
    timestamp: Date.now() - 25000,
    privateThought: "我真的是预言家，昨晚查验了4号是好人。",
  },
]);

// 添加测试消息
const addMessage = (type: string) => {
  const now = Date.now();
  let newMessage: ChatMessage;

  if (type === "system" || type === "judge") {
    newMessage = {
      id: String(messageId++),
      type: "system",
      playerName: type === "judge" ? "法官" : "系统",
      playerId: -1,
      content: `${type === "judge" ? "法官宣布" : "系统通知"}: ${new Date().toLocaleTimeString()} 测试消息`,
      timestamp: now,
    };
  } else {
    const playerId = type === "player" ? (Math.random() > 0.5 ? 1 : 2) : 3;
    const isOwnMessage = playerId === currentViewId;
    newMessage = {
      id: String(messageId++),
      type: "speak",
      playerName: `玩家${playerId}`,
      playerId,
      content: `这是来自玩家${playerId}的测试消息${isOwnMessage ? "（这是你自己的消息）" : ""}`,
      timestamp: now,
      privateThought:
        Math.random() > 0.5 ? `内心独白: 玩家${playerId}在思考...` : undefined,
    };
  }

  mockMessages.value.push(newMessage);
};

const setViewId = (viewId: number) => {
  currentViewId.value = viewId;
};

const clearMessages = () => {
  mockMessages.value = [];
  messageId = 0;
};
</script>

<style scoped>
@import url("@/style.css");
</style>
